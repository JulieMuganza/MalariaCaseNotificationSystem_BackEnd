import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { hashToken, randomToken } from '../utils/cryptoToken.js';
import { appRoleToPrisma, type AppRole } from '../utils/role.js';
import { mapUserToApi } from '../mappers/user.mapper.js';
import { sendMail, adminInviteEmailBody } from './email.service.js';
import type { z } from 'zod';
import type { createUserSchema, updateUserSchema } from '../validators/user.schemas.js';

type CreateUserInput = z.infer<typeof createUserSchema>;
type UpdateUserInput = z.infer<typeof updateUserSchema>;

const APP_ROLES: AppRole[] = [
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

function parseAppRole(s: string): AppRole {
  if (!APP_ROLES.includes(s as AppRole)) {
    throw new HttpError(400, 'Invalid role');
  }
  return s as AppRole;
}

export async function listUsers(query: { search?: string; role?: string }) {
  const where: Record<string, unknown> = {};
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (query.role) {
    where.role = appRoleToPrisma(parseAppRole(query.role));
  }
  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map(mapUserToApi);
}

export async function createUserAdmin(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) throw new HttpError(409, 'Email already registered');
  const plainPassword = input.password;
  const passwordHash = await bcrypt.hash(plainPassword, env.BCRYPT_ROUNDS);
  const active = input.status !== 'Inactive';
  const mustChange =
    active && (input.mustChangePassword ?? true);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: appRoleToPrisma(input.role),
      district: input.district,
      staffCode: input.staffCode,
      status: active ? 'ACTIVE' : 'INACTIVE',
      emailVerified: true,
      mustChangePassword: mustChange,
    },
  });

  if (active && mustChange) {
    const raw = randomToken(32);
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    const setPasswordUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(raw)}`;
    const { text, html } = adminInviteEmailBody(user.name, plainPassword, setPasswordUrl);
    try {
      await sendMail({
        to: user.email,
        subject: 'Your account — Malaria Case Notification',
        text,
        html,
      });
    } catch (err) {
      console.error('Failed to send admin invite email:', err);
    }
  }

  return mapUserToApi(user);
}

export async function updateUserAdmin(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'User not found');
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = appRoleToPrisma(input.role);
  if (input.district !== undefined) data.district = input.district;
  if (input.staffCode !== undefined) data.staffCode = input.staffCode;
  if (input.status !== undefined)
    data.status = input.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE';
  const updated = await prisma.user.update({ where: { id }, data: data as object });
  return mapUserToApi(updated);
}

export async function deactivateUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'User not found');
  await prisma.session.deleteMany({ where: { userId: id } });
  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });
  return mapUserToApi(updated);
}
