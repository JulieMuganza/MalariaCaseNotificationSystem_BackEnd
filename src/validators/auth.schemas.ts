import { z } from 'zod';
import type { AppRole } from '../utils/role.js';

const appRoles: [AppRole, ...AppRole[]] = [
  'CHW',
  'Health Center',
  'Local Clinic',
  'District Hospital',
  'Referral Hospital',
  'Admin',
  'RICH',
  'PFTH',
  'SFR',
];

/** Public self-registration — no `role` field: server always assigns CHW. `.strict()` rejects tampering (e.g. role: Admin). */
export const registerSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    phone: z.string().min(7).max(30),
    district: z.string().max(100).optional().default(''),
    staffCode: z.string().max(50).optional(),
  })
  .strict();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const completePasswordSetupSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

/** Self-service profile: CHW may update district (e.g. after transfer); any user may update display name. */
export const patchMeSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    district: z.string().min(1).max(100).optional(),
    phone: z.string().min(7).max(30).optional(),
  })
  .strict()
  .refine((b) => b.name !== undefined || b.district !== undefined || b.phone !== undefined, {
    message: 'Provide at least one of: name, district, phone',
  });

