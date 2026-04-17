import type { User } from '@prisma/client';
import { prismaRoleToApp } from '../utils/role.js';

export function mapUserToApi(u: User) {
  const status =
    u.status === 'ACTIVE' ? 'Active'
    : u.status === 'INACTIVE' ? 'Inactive'
    : 'Pending verification';
  return {
    id: u.id,
    name: u.name,
    role: prismaRoleToApp(u.role),
    district: u.district,
    status,
    lastActive: u.lastActiveAt.toISOString(),
    email: u.email,
    emailVerified: u.emailVerified,
    mustChangePassword: u.mustChangePassword,
  };
}
