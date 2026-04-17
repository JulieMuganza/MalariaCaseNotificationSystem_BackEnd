import type { UserRole } from '@prisma/client';

/** API / frontend role strings */
export type AppRole =
  | 'CHW'
  | 'Health Center'
  | 'Local Clinic'
  | 'District Hospital'
  | 'Referral Hospital'
  | 'Admin'
  | 'RICH'
  | 'PFTH'
  | 'SFR';

export function prismaRoleToApp(role: UserRole): AppRole {
  switch (role) {
    case 'CHW':
      return 'CHW';
    case 'HEALTH_CENTER':
      return 'Health Center';
    case 'LOCAL_CLINIC':
      return 'Local Clinic';
    case 'HOSPITAL':
      return 'District Hospital';
    case 'REFERRAL_HOSPITAL':
      return 'Referral Hospital';
    case 'ADMIN':
      return 'Admin';
    case 'RICH':
      return 'RICH';
    case 'PFTH':
      return 'PFTH';
    case 'SFR':
      return 'SFR';
    default:
      return 'CHW';
  }
}

export function appRoleToPrisma(role: AppRole): UserRole {
  switch (role) {
    case 'CHW':
      return 'CHW';
    case 'Health Center':
      return 'HEALTH_CENTER';
    case 'Local Clinic':
      return 'LOCAL_CLINIC';
    case 'District Hospital':
      return 'HOSPITAL';
    case 'Referral Hospital':
      return 'REFERRAL_HOSPITAL';
    case 'Admin':
      return 'ADMIN';
    case 'RICH':
      return 'RICH';
    case 'PFTH':
      return 'PFTH';
    case 'SFR':
      return 'SFR';
    default:
      return 'CHW';
  }
}

export function notificationTargetMatchesUser(
  targetRole: UserRole,
  userRole: UserRole
): boolean {
  if (userRole === 'ADMIN') return true;
  return targetRole === userRole;
}
