import 'dotenv/config';
import { z } from 'zod';
import crypto from 'node:crypto';

/** Dotenv values are strings; `z.coerce.boolean()` wrongly treats "false" as true (Boolean("false")). */
const envBool = (defaultValue: boolean) =>
  z.preprocess((v: unknown) => {
    if (v === undefined || v === '' || v === null) return defaultValue;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase().trim();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
    return defaultValue;
  }, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.preprocess((v: unknown) => {
    if (typeof v === 'string' && v.trim()) return v;
    const fromRender =
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_INTERNAL_URL ??
      process.env.POSTGRES_PRISMA_URL;
    if (typeof fromRender === 'string' && fromRender.trim()) return fromRender;
    return v;
  }, z.string().min(1)),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.preprocess((v: unknown) => {
    if (typeof v === 'string' && v.trim().length >= 32) return v.trim();
    if (typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.trim().length >= 32) {
      return process.env.JWT_SECRET.trim();
    }
    return crypto.randomBytes(48).toString('hex');
  }, z.string().min(32)),
  JWT_REFRESH_SECRET: z.preprocess((v: unknown) => {
    if (typeof v === 'string' && v.trim().length >= 32) return v.trim();
    if (
      typeof process.env.JWT_SECRET === 'string' &&
      process.env.JWT_SECRET.trim().length >= 32
    ) {
      return process.env.JWT_SECRET.trim();
    }
    return crypto.randomBytes(48).toString('hex');
  }, z.string().min(32)),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),
  BCRYPT_ROUNDS: z.coerce.number().min(4).max(14).default(12),
  /** Set for Google Sign-In (OAuth 2.0). Leave empty to disable browser Google flow. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Must match the authorized redirect URI in Google Cloud Console */
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  /** New Google users: default app role and district */
  GOOGLE_DEFAULT_ROLE: z
    .enum([
      'CHW',
      'Health Center',
      'Local Clinic',
      'District Hospital',
      'Referral Hospital',
      'Admin',
      'RICH',
      'PFTH',
      'SFR',
    ])
    .default('CHW'),
  GOOGLE_DEFAULT_DISTRICT: z.string().default('Huye'),
  /** If empty, outbound email is logged to the server console (development). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: envBool(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('Malaria Case Notification <noreply@localhost>'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const env = loadEnv();

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn(
    '[env] JWT_ACCESS_SECRET / JWT_REFRESH_SECRET not set; generated temporary secrets for this process. Set both vars in Render for stable auth sessions.'
  );
}
