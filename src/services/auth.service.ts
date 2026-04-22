import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { hashToken, randomToken } from '../utils/cryptoToken.js';
import { signAccessToken } from '../utils/jwt.js';
import { appRoleToPrisma } from '../utils/role.js';
import type { z } from 'zod';
import type { registerSchema, loginSchema } from '../validators/auth.schemas.js';
import { mapUserToApi } from '../mappers/user.mapper.js';
import {
  sendMail,
  registrationOtpEmailBody,
  passwordResetEmailBody,
} from './email.service.js';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
const MS_DAY = 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 15 * 60 * 1000;

function generateSixDigitOtp(): string {
  if (process.env.NODE_ENV === 'test') return '123456';
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const rawRefresh = randomToken(48);
  const refreshHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * MS_DAY);
  const session = await prisma.session.create({
    data: {
      userId,
      refreshHash,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    },
  });
  return { sessionId: session.id, rawRefresh, expiresAt };
}

export async function registerUser(
  input: RegisterInput,
  meta?: { userAgent?: string; ip?: string }
) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');

  const district = input.district.trim() || env.GOOGLE_DEFAULT_DISTRICT;
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const otp = generateSixDigitOtp();
  const otpHash = hashToken(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      phone: input.phone.trim(),
      role: appRoleToPrisma('CHW'),
      district,
      staffCode: input.staffCode,
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
    },
  });

  const verifyUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/otp?email=${encodeURIComponent(email)}`;
  const { text, html } = registrationOtpEmailBody(otp, verifyUrl);
  try {
    await sendMail({
      to: email,
      subject: 'Verify your email — Malaria Case Notification',
      text,
      html,
    });
  } catch (err) {
    await prisma.user.delete({ where: { id: created.id } }).catch(() => {});
    console.error('Registration email failed:', err);
    throw new HttpError(
      503,
      'Could not send verification email. Check SMTP settings and network, then try again.'
    );
  }

  return {
    message: 'Check your email for a verification code.',
    email,
  };
}

export async function verifyRegistrationOtp(
  emailRaw: string,
  code: string,
  meta?: { userAgent?: string; ip?: string }
) {
  const email = emailRaw.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'PENDING_VERIFICATION') {
    throw new HttpError(400, 'Invalid verification request');
  }
  if (
    !user.emailVerificationOtpHash ||
    !user.emailVerificationOtpExpiresAt ||
    user.emailVerificationOtpExpiresAt < new Date()
  ) {
    throw new HttpError(400, 'Code expired. Request a new code.');
  }
  if (user.emailVerificationOtpHash !== hashToken(code.trim())) {
    throw new HttpError(400, 'Invalid code');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: 'ACTIVE',
      emailVerified: true,
      emailVerificationOtpHash: null,
      emailVerificationOtpExpiresAt: null,
    },
  });

  const tokens = await issueTokensForUser(updated, meta);
  return { user: mapUserToApi(updated), ...tokens };
}

export async function resendRegistrationOtp(emailRaw: string) {
  const email = emailRaw.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = { message: 'If this email is pending verification, a new code was sent.' };
  if (!user || user.status !== 'PENDING_VERIFICATION') return generic;

  const otp = generateSixDigitOtp();
  const otpHash = hashToken(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
    },
  });

  const verifyUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/otp?email=${encodeURIComponent(email)}`;
  const { text, html } = registrationOtpEmailBody(otp, verifyUrl);
  await sendMail({
    to: email,
    subject: 'Your verification code — Malaria Case Notification',
    text,
    html,
  });

  return generic;
}

export async function loginUser(
  input: LoginInput,
  meta?: { userAgent?: string; ip?: string }
) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (!user || !user.passwordHash) throw new HttpError(401, 'Invalid email or password');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  if (user.status === 'PENDING_VERIFICATION') {
    throw new HttpError(403, 'Please verify your email using the code we sent you.');
  }
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Account inactive');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  const tokens = await issueTokensForUser(user, meta);
  return { user: mapUserToApi(user), ...tokens };
}

export async function issueTokensForUser(user: User, meta?: { userAgent?: string; ip?: string }) {
  const { rawRefresh, sessionId } = await createSession(user.id, meta);
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });
  return {
    accessToken,
    refreshToken: `${sessionId}.${rawRefresh}`,
    tokenType: 'Bearer' as const,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

export async function refreshSession(
  refreshToken: string,
  meta?: { userAgent?: string; ip?: string }
) {
  const [sessionId, raw] = refreshToken.split('.');
  if (!sessionId || !raw) throw new HttpError(401, 'Invalid refresh token');

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.expiresAt < new Date()) {
    throw new HttpError(401, 'Session expired');
  }
  const expected = hashToken(raw);
  if (session.refreshHash !== expected) throw new HttpError(401, 'Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'Invalid session');

  await prisma.session.delete({ where: { id: session.id } });
  const tokens = await issueTokensForUser(user, meta);
  return { user: mapUserToApi(user), ...tokens };
}

export async function logoutSession(refreshToken: string) {
  const [sessionId, raw] = refreshToken.split('.');
  if (!sessionId || !raw) return;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return;
  if (session.refreshHash === hashToken(raw)) {
    await prisma.session.delete({ where: { id: session.id } });
  }
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'User not found');
  return mapUserToApi(user);
}

/** Authenticated user updates their own profile. District changes are limited to CHW. */
export async function updateMyProfile(
  userId: string,
  role: UserRole,
  input: { name?: string; district?: string; phone?: string }
) {
  if (input.district !== undefined && role !== 'CHW') {
    throw new HttpError(
      403,
      'Only CHW accounts may update district here. Ask an admin to change district for other roles.'
    );
  }
  const data: { name?: string; district?: string; phone?: string | null } = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.district !== undefined) data.district = input.district.trim();
  if (input.phone !== undefined) data.phone = input.phone.trim() || null;
  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });
  return mapUserToApi(updated);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const generic = {
    message: 'If an account exists for this email, password reset instructions were sent.',
  };
  if (!user || !user.passwordHash) return generic;

  const raw = randomToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(raw)}`;
  const { text, html } = passwordResetEmailBody(resetUrl);
  await sendMail({
    to: user.email,
    subject: 'Reset your password — Malaria Case Notification',
    text,
    html,
  });

  const devPayload =
    env.NODE_ENV !== 'production' && !env.SMTP_HOST ?
      {
        debugResetLink: resetUrl,
      }
    : {};

  return { ...generic, ...devPayload };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new HttpError(400, 'Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { message: 'Password updated. Please sign in again.' };
}

export async function completePasswordSetup(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mustChangePassword) {
    throw new HttpError(400, 'Password setup is not required for this account.');
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  return { user: mapUserToApi(updated) };
}
