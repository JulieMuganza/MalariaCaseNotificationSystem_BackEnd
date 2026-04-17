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

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  role: z.enum(appRoles),
  district: z.string().min(1),
  staffCode: z.string().max(50).optional(),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  /** When false, user can sign in with the password above without forced change (demo / trusted accounts). */
  mustChangePassword: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(appRoles).optional(),
  district: z.string().min(1).optional(),
  staffCode: z.string().max(50).optional().nullable(),
  status: z.enum(['Active', 'Inactive']).optional(),
});
