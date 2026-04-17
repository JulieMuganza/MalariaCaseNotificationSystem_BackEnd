import type { UserRole } from '@prisma/client';

/** Southern + Eastern + Western → RICH (Rwanda Interfaith Council for Health). */
export const RICH_PROVINCE_FILTERS = [
  'Southern Province',
  'Eastern Province',
  'Western Province',
] as const;

/** Northern Province → PFTH (Pro-Femmes Twese Hamwe). */
export const PFTH_PROVINCE = 'Northern Province';

/** Kigali City → SFR (Strive Foundation Rwanda). */
export const SFR_PROVINCE = 'Kigali City';

/**
 * Which surveillance partner receives full “risk assessment” notifications for a case,
 * based on administrative province.
 */
export function surveillanceTargetForProvince(
  province: string | null | undefined
): Extract<UserRole, 'RICH' | 'PFTH' | 'SFR'> {
  const p = (province ?? '').trim().toLowerCase();
  if (p.includes('kigali')) return 'SFR';
  if (p.includes('northern')) return 'PFTH';
  return 'RICH';
}

/** Prisma `where` fragment: cases visible to RICH (multi-province + legacy null province). */
export function richCaseProvinceWhere(): object {
  return {
    OR: [
      ...RICH_PROVINCE_FILTERS.map((province) => ({
        province: { equals: province, mode: 'insensitive' as const },
      })),
      { province: null },
      { province: '' },
    ],
  };
}

export function pfthCaseProvinceWhere(): object {
  return {
    province: { equals: PFTH_PROVINCE, mode: 'insensitive' as const },
  };
}

export function sfrCaseProvinceWhere(): object {
  return {
    province: { equals: SFR_PROVINCE, mode: 'insensitive' as const },
  };
}

export function listWhereForSurveillancePartner(role: UserRole): object {
  if (role === 'RICH') return richCaseProvinceWhere();
  if (role === 'PFTH') return pfthCaseProvinceWhere();
  if (role === 'SFR') return sfrCaseProvinceWhere();
  return { id: { in: [] as string[] } };
}

export function surveillancePartnerCanAccessCase(
  role: Extract<UserRole, 'RICH' | 'PFTH' | 'SFR'>,
  province: string | null | undefined
): boolean {
  const target = surveillanceTargetForProvince(province);
  return target === role;
}
