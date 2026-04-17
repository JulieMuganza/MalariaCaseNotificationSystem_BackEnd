import { OAuth2Client } from 'google-auth-library';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { randomToken } from '../utils/cryptoToken.js';
import { appRoleToPrisma, type AppRole } from '../utils/role.js';
import { issueTokensForUser } from './auth.service.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map<string, number>();

function purgeExpiredStates() {
  const now = Date.now();
  for (const [k, exp] of oauthStates) {
    if (exp < now) oauthStates.delete(k);
  }
}

function getClient(): OAuth2Client {
  const redirect = env.GOOGLE_REDIRECT_URI ?? `${env.APP_BASE_URL}/api/v1/auth/google/callback`;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new HttpError(503, 'Google OAuth is not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirect);
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** Redirect browser to Google consent screen */
export function redirectToGoogleAuth(res: { redirect: (url: string) => void }) {
  purgeExpiredStates();
  const state = randomToken(24);
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  const client = getClient();
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
  res.redirect(url);
}

type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new HttpError(502, `Google userinfo failed: ${t}`);
  }
  const j = (await r.json()) as Record<string, unknown>;
  const sub = typeof j.sub === 'string' ? j.sub : '';
  const email = typeof j.email === 'string' ? j.email : '';
  if (!sub || !email) throw new HttpError(502, 'Invalid Google profile');
  return {
    sub,
    email: email.toLowerCase(),
    name: typeof j.name === 'string' ? j.name : undefined,
    picture: typeof j.picture === 'string' ? j.picture : undefined,
  };
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  const email = profile.email;
  const role = appRoleToPrisma(env.GOOGLE_DEFAULT_ROLE as AppRole);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email }] },
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        email,
        name: profile.name ?? email.split('@')[0],
        googleId: profile.sub,
        passwordHash: null,
        emailVerified: true,
        role,
        district: env.GOOGLE_DEFAULT_DISTRICT,
        status: 'ACTIVE',
      },
    });
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      googleId: profile.sub,
      emailVerified: true,
      lastActiveAt: new Date(),
      ...(profile.name ? { name: profile.name } : {}),
    },
  });
}

/**
 * OAuth callback: validate state, exchange code, upsert user, redirect to SPA with tokens in query.
 */
export async function handleGoogleCallback(
  req: Request,
  meta?: { userAgent?: string; ip?: string }
): Promise<string> {
  const q = req.query as Record<string, string | undefined>;
  if (q.error) {
    throw new HttpError(400, String(q.error));
  }
  const code = q.code;
  const state = q.state;
  if (!code || !state) {
    throw new HttpError(400, 'Missing authorization code or state');
  }

  purgeExpiredStates();
  const exp = oauthStates.get(state);
  if (!exp || exp < Date.now()) {
    throw new HttpError(400, 'Invalid or expired OAuth state. Please try signing in again.');
  }
  oauthStates.delete(state);

  const client = getClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new HttpError(502, 'Google did not return an access token');
  }

  const profile = await fetchGoogleProfile(tokens.access_token);
  const user = await upsertGoogleUser(profile);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  const issued = await issueTokensForUser(user, meta);
  const target = new URL(`${env.FRONTEND_URL.replace(/\/$/, '')}/auth/google/callback`);
  target.searchParams.set('accessToken', issued.accessToken);
  target.searchParams.set('refreshToken', issued.refreshToken);
  return target.toString();
}
