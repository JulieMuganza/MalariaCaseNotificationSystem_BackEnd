import dns from 'node:dns';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/** Prefer IPv4 ordering for any fallback lookups */
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* Node < 17 */
}

/**
 * Nodemailer picks a *random* address from IPv4+IPv6 (see nodemailer/lib/shared), so broken IPv6
 * often wins. We resolve A records only and connect by IPv4, with TLS SNI = real hostname.
 */
let smtpTransportPromise: Promise<nodemailer.Transporter> | null = null;

function getSmtpTransporter(): Promise<nodemailer.Transporter> {
  if (!smtpTransportPromise) {
    smtpTransportPromise = (async () => {
      const hostname = env.SMTP_HOST!;
      let host = hostname;
      try {
        const v4 = await dns.promises.resolve4(hostname);
        if (v4.length > 0) {
          host = v4[Math.floor(Math.random() * v4.length)]!;
        }
      } catch (e) {
        console.warn('[email] Could not resolve SMTP host to IPv4, using hostname:', e);
      }

      const port = env.SMTP_PORT;
      // Port 587/25 = STARTTLS (plain socket first). Port 465 = implicit TLS. Wrong combo → "wrong version number".
      const implicitTls = port === 465;
      const secure = implicitTls || (![587, 25, 2525, 2587].includes(port) && env.SMTP_SECURE);

      return nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS: !secure && port === 587,
        ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
        tls: {
          servername: hostname,
        },
      });
    })();
  }
  return smtpTransportPromise;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const from = env.SMTP_FROM;
  if (!env.SMTP_HOST) {
    console.log('\n--- [email: dev mode, no SMTP_HOST] ---');
    console.log(`From: ${from}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(options.text);
    console.log('---\n');
    return;
  }

  const t = await getSmtpTransporter();
  await t.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(options.text)}</pre>`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function registrationOtpEmailBody(otp: string, verifyUrl: string): { text: string; html: string } {
  const text = [
    'Verify your Malaria Case Notification account',
    '',
    `Your one-time code is: ${otp}`,
    '',
    `Or open: ${verifyUrl}`,
    '',
    'This code expires in 15 minutes.',
  ].join('\n');
  const html = `
    <p>Verify your <strong>Malaria Case Notification</strong> account.</p>
    <p style="font-size:20px;font-weight:bold;letter-spacing:4px">${otp}</p>
    <p><a href="${verifyUrl}">Open verification page</a></p>
    <p style="color:#666;font-size:12px">This code expires in 15 minutes.</p>
  `;
  return { text, html };
}

export function passwordResetEmailBody(resetUrl: string): { text: string; html: string } {
  const text = [
    'Password reset',
    '',
    `Use this link to set a new password (valid for 1 hour):`,
    resetUrl,
  ].join('\n');
  const html = `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
  return { text, html };
}

export function adminInviteEmailBody(
  name: string,
  tempPassword: string,
  setPasswordUrl: string
): { text: string; html: string } {
  const text = [
    `Hello ${name},`,
    '',
    'An administrator created your account in the Malaria Case Notification System.',
    '',
    'STEP 1 — Sign in with this temporary password:',
    tempPassword,
    '',
    'STEP 2 — Choose a new password (recommended):',
    '- Open the secure link below, or',
    '- Sign in with the temporary password; you will be prompted to set a new password.',
    '',
    setPasswordUrl,
    '',
    'Keep this email confidential. If you did not expect this account, contact your administrator.',
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;line-height:1.5;color:#111827">
      <p style="margin:0 0 12px">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;color:#374151">Your account is ready. Use the <strong>temporary password</strong> below to sign in, then set your own password using the link (or follow the prompt after login).</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Temporary password</p>
        <p style="margin:0;font-family:ui-monospace,monospace;font-size:15px;font-weight:600;color:#0f766e">${escapeHtml(tempPassword)}</p>
      </div>
      <a href="${setPasswordUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;margin:8px 0 16px">Set a new password</a>
      <p style="margin:0;font-size:12px;color:#64748b">If the button does not work, copy this link into your browser:<br/><span style="word-break:break-all">${escapeHtml(setPasswordUrl)}</span></p>
    </div>
  `;
  return { text, html };
}
