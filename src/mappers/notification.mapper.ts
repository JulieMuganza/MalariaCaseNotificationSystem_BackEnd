import type { Notification } from '@prisma/client';
import { prismaRoleToApp } from '../utils/role.js';

export function mapNotificationToApi(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    caseId: n.caseRef ?? undefined,
    timestamp: n.createdAt.toISOString(),
    read: n.read,
    targetRole: prismaRoleToApp(n.targetRole),
    phase: n.phase ?? undefined,
    contentLevel: n.contentLevel ?? undefined,
    recipientRoles: n.recipientRoles ?? undefined,
  };
}
