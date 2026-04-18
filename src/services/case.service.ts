import type {
  CaseStatus,
  ChwPrimaryReferral,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  mapCaseToApi,
  mapCaseStatusToApi,
  mapCaseToApiForViewer,
} from '../mappers/case.mapper.js';
import type { CreateCaseInput, PatchCaseInput } from '../validators/case.schemas.js';
import {
  buildCreateCaseData,
  buildPatchCaseData,
  prismaCaseStatusFromApiString,
} from './case.helpers.js';
import {
  createNotificationsForNewCase,
  createNotificationsForHcNewCase,
  createHcFacilityCaseNotification,
  emitCaseTransitionNotifications,
} from './notification.service.js';
import { sanitizePatchForRole } from './case.patch-policy.js';
import {
  listWhereForSurveillancePartner,
  surveillancePartnerCanAccessCase,
} from '../utils/surveillancePartner.js';

/** Case-insensitive district match (HC/LC/DH scope vs `MalariaCase.district`). */
function eqDistrict(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function prismaDistrictScope(district: string) {
  return { equals: district.trim(), mode: 'insensitive' as const };
}

/** Cases in this status are under district hospital care even if HC forgot to set transfer datetime. */
const DISTRICT_HOSPITAL_PIPELINE: CaseStatus[] = [
  'Escalated',
  'Admitted',
  'Treated',
  'Discharged',
  'Deceased',
];

/** HC sees only severe/referral pathway cases; non-severe CHW-only cases stay in CHW workspace. */
const HEALTH_CENTER_VISIBLE_STATUSES: CaseStatus[] = [
  'HC_Received',
  'Escalated',
  'Admitted',
  'Treated',
  'Discharged',
  'Deceased',
];

function districtHospitalCanAccessCase(
  district: string,
  c: {
    district: string;
    transferredToReferralHospital: boolean;
    hcPatientTransferredToHospitalDateTime: Date | null;
    hospitalReceivedDateTime: Date | null;
    status: CaseStatus;
  }
): boolean {
  if (!eqDistrict(c.district, district)) return false;
  /** Keep access after referral transfer so DH can open history (read-only at UI). */
  if (c.transferredToReferralHospital) {
    return (
      c.hcPatientTransferredToHospitalDateTime != null ||
      c.hospitalReceivedDateTime != null
    );
  }
  // Do not show community / HC-only closures (never referred to district care).
  if (
    c.status === 'Pending' ||
    c.status === 'Referred' ||
    c.status === 'Resolved' ||
    c.status === 'HC_Received'
  ) {
    return false;
  }
  if (DISTRICT_HOSPITAL_PIPELINE.includes(c.status)) return true;
  if (c.hcPatientTransferredToHospitalDateTime != null) return true;
  if (c.hospitalReceivedDateTime != null) return true;
  return false;
}

function firstLineFacilityCanAccessCase(
  district: string,
  c: {
    district: string;
    chwPrimaryReferral: ChwPrimaryReferral;
    symptomCount: number;
    hcPatientReceivedDateTime: Date | null;
    hcPatientTransferredToHospitalDateTime: Date | null;
    status: CaseStatus;
  },
  expected: ChwPrimaryReferral
): boolean {
  if (!eqDistrict(c.district, district)) return false;
  if (c.chwPrimaryReferral !== expected) return false;
  if (c.symptomCount > 0) return true;
  if (c.hcPatientReceivedDateTime != null) return true;
  if (c.hcPatientTransferredToHospitalDateTime != null) return true;
  return HEALTH_CENTER_VISIBLE_STATUSES.includes(c.status);
}

/** HC inbox: primary HC referrals + same-district LC-tagged cases still Pending/Referred (shared catchment / mis-routing). */
function healthCenterCanAccessCase(
  district: string,
  c: Parameters<typeof firstLineFacilityCanAccessCase>[1]
): boolean {
  if (!eqDistrict(c.district, district)) return false;
  if (c.chwPrimaryReferral === 'HEALTH_CENTER') {
    return firstLineFacilityCanAccessCase(district, c, 'HEALTH_CENTER');
  }
  if (
    c.chwPrimaryReferral === 'LOCAL_CLINIC' &&
    (c.status === 'Pending' || c.status === 'Referred')
  ) {
    return (
      c.symptomCount > 0 ||
      c.hcPatientReceivedDateTime != null ||
      c.hcPatientTransferredToHospitalDateTime != null ||
      HEALTH_CENTER_VISIBLE_STATUSES.includes(c.status)
    );
  }
  return false;
}

function localClinicCanAccessCase(
  district: string,
  c: Parameters<typeof firstLineFacilityCanAccessCase>[1]
): boolean {
  return firstLineFacilityCanAccessCase(district, c, 'LOCAL_CLINIC');
}

async function nextCaseRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SM-${year}-`;
  const last = await prisma.case.findFirst({
    where: { caseRef: { startsWith: prefix } },
    orderBy: { caseRef: 'desc' },
    select: { caseRef: true },
  });
  let n = 1;
  if (last?.caseRef) {
    const part = last.caseRef.replace(prefix, '');
    const parsed = parseInt(part, 10);
    if (!Number.isNaN(parsed)) n = parsed + 1;
  }
  return `${prefix}${String(n).padStart(4, '0')}`;
}

function listWhereForRole(
  role: UserRole,
  userId: string,
  district: string
): object {
  if (role === 'ADMIN') return {};
  if (role === 'RICH' || role === 'PFTH' || role === 'SFR') {
    return listWhereForSurveillancePartner(role);
  }
  if (role === 'CHW') return { reportedByUserId: userId };
  if (role === 'HEALTH_CENTER') {
    const firstLineVisibility = {
      OR: [
        { symptomCount: { gt: 0 } },
        { hcPatientReceivedDateTime: { not: null } },
        { hcPatientTransferredToHospitalDateTime: { not: null } },
        { status: { in: HEALTH_CENTER_VISIBLE_STATUSES } },
      ],
    };
    return {
      OR: [
        {
          AND: [
            { district: prismaDistrictScope(district) },
            { chwPrimaryReferral: 'HEALTH_CENTER' },
            firstLineVisibility,
          ],
        },
        {
          AND: [
            { district: prismaDistrictScope(district) },
            { chwPrimaryReferral: 'LOCAL_CLINIC' },
            { status: { in: ['Pending', 'Referred'] } },
            firstLineVisibility,
          ],
        },
      ],
    };
  }
  if (role === 'LOCAL_CLINIC') {
    return {
      district: prismaDistrictScope(district),
      chwPrimaryReferral: 'LOCAL_CLINIC',
      OR: [
        { symptomCount: { gt: 0 } },
        { hcPatientReceivedDateTime: { not: null } },
        { hcPatientTransferredToHospitalDateTime: { not: null } },
        { status: { in: HEALTH_CENTER_VISIBLE_STATUSES } },
      ],
    };
  }
  if (role === 'HOSPITAL') {
    return {
      district: prismaDistrictScope(district),
      OR: [
        {
          transferredToReferralHospital: false,
          NOT: {
            status: { in: ['Pending', 'Referred', 'Resolved', 'HC_Received'] },
          },
          OR: [
            { hcPatientTransferredToHospitalDateTime: { not: null } },
            { hospitalReceivedDateTime: { not: null } },
            { status: { in: DISTRICT_HOSPITAL_PIPELINE } },
          ],
        },
        {
          transferredToReferralHospital: true,
          OR: [
            { hcPatientTransferredToHospitalDateTime: { not: null } },
            { hospitalReceivedDateTime: { not: null } },
          ],
        },
      ],
    };
  }
  if (role === 'REFERRAL_HOSPITAL') {
    return {
      district: prismaDistrictScope(district),
      transferredToReferralHospital: true,
    };
  }
  return { reportedByUserId: userId };
}

export async function listCases(
  role: UserRole,
  userId: string,
  district: string,
  query: { status?: string; district?: string; search?: string }
) {
  const base = listWhereForRole(role, userId, district);
  let where: Record<string, unknown> = { ...base };
  if (
    query.district &&
    (role === 'ADMIN' ||
      role === 'RICH' ||
      role === 'PFTH' ||
      role === 'SFR')
  ) {
    where.district = prismaDistrictScope(query.district);
  }
  if (query.status) {
    where.status = prismaCaseStatusFromApiString(query.status);
  }
  if (query.search) {
    const s = query.search.trim();
    const searchClause = {
      OR: [
        { patientName: { contains: s, mode: 'insensitive' } },
        { caseRef: { contains: s, mode: 'insensitive' } },
        { patientCode: { contains: s, mode: 'insensitive' } },
      ],
    };
    where = { AND: [where, searchClause] };
  }
  const rows = await prisma.case.findMany({
    where,
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((row) => mapCaseToApiForViewer(row, role));
}

function canAccessCase(
  role: UserRole,
  userId: string,
  district: string,
  c: {
    province: string | null;
    district: string;
    reportedByUserId: string | null;
    symptomCount: number;
    chwPrimaryReferral: ChwPrimaryReferral;
    hcPatientReceivedDateTime: Date | null;
    transferredToReferralHospital: boolean;
    hcPatientTransferredToHospitalDateTime: Date | null;
    hospitalReceivedDateTime: Date | null;
    status: CaseStatus;
  }
): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'RICH' || role === 'PFTH' || role === 'SFR') {
    return surveillancePartnerCanAccessCase(role, c.province);
  }
  if (role === 'CHW' && c.reportedByUserId === userId) return true;
  if (role === 'HEALTH_CENTER') {
    return healthCenterCanAccessCase(district, c);
  }
  if (role === 'LOCAL_CLINIC') {
    return localClinicCanAccessCase(district, c);
  }
  if (role === 'HOSPITAL') {
    return districtHospitalCanAccessCase(district, c);
  }
  if (role === 'REFERRAL_HOSPITAL') {
    return eqDistrict(c.district, district) && c.transferredToReferralHospital;
  }
  return false;
}

/** Supports human ref (e.g. SM-2026-0001) or Prisma `id` for deep links / tooling. */
async function findCaseByRefOrId(ref: string) {
  return prisma.case.findFirst({
    where: { OR: [{ caseRef: ref }, { id: ref }] },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function getCaseByRef(
  caseRef: string,
  role: UserRole,
  userId: string,
  district: string
) {
  const c = await findCaseByRefOrId(caseRef);
  if (!c) throw new HttpError(404, 'Case not found');
  if (!canAccessCase(role, userId, district, c)) {
    throw new HttpError(403, 'Forbidden');
  }
  return mapCaseToApiForViewer(c, role);
}

export async function createCase(
  input: CreateCaseInput,
  reporter: {
    id: string;
    name: string;
    staffCode: string | null;
    role: UserRole;
    district: string;
  }
) {
  const caseRef = await nextCaseRef();
  const data = buildCreateCaseData(input, {
    caseRef,
    reporterUserId: reporter.id,
    reporterRole: reporter.role,
    reporterDistrict: reporter.district,
    chwName: reporter.name,
    chwStaffCode: reporter.staffCode,
  });
  const firstLineReporter =
    reporter.role === 'HEALTH_CENTER' || reporter.role === 'LOCAL_CLINIC';
  const created = (await prisma.case.create({
    data: {
      ...data,
      timeline: {
        create: {
          event:
            reporter.role === 'LOCAL_CLINIC'
              ? data.symptoms.length > 0
                ? 'Case registered at Local Clinic (walk-in severe case)'
                : 'Case closed at Local Clinic (non-severe, no transfer)'
              : reporter.role === 'HEALTH_CENTER'
                ? data.symptoms.length > 0
                  ? 'Case registered at Health Center (walk-in severe case)'
                  : 'Case closed at Health Center (non-severe, no transfer)'
                : data.symptoms.length > 0
                  ? 'Case reported by CHW'
                  : 'Case closed at CHW (non-severe malaria, no referral/transfer)',
          actorName: reporter.name,
          actorRole:
            reporter.role === 'LOCAL_CLINIC'
              ? 'Local Clinic'
              : reporter.role === 'HEALTH_CENTER'
                ? 'Health Center'
                : 'CHW',
        },
      },
    },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  })) as Prisma.CaseGetPayload<{
    include: { timeline: { orderBy: { createdAt: 'asc' } } };
  }>;
  if (created.symptoms.length > 0 && reporter.role === 'CHW') {
    await createNotificationsForNewCase(created);
  } else if (created.symptoms.length > 0 && firstLineReporter) {
    await createNotificationsForHcNewCase(created, reporter.name);
  }
  if (firstLineReporter) {
    await createHcFacilityCaseNotification(created, reporter.name);
  }
  return mapCaseToApiForViewer(created, reporter.role);
}

export async function patchCase(
  caseRef: string,
  input: PatchCaseInput,
  role: UserRole,
  userId: string,
  district: string,
  actorName: string
) {
  const c = await findCaseByRefOrId(caseRef);
  if (!c) throw new HttpError(404, 'Case not found');
  const can =
    role === 'ADMIN' ||
    (role === 'HEALTH_CENTER' && healthCenterCanAccessCase(district, c)) ||
    (role === 'LOCAL_CLINIC' &&
      eqDistrict(c.district, district) &&
      c.chwPrimaryReferral === 'LOCAL_CLINIC') ||
    (role === 'HOSPITAL' && districtHospitalCanAccessCase(district, c)) ||
    (role === 'REFERRAL_HOSPITAL' &&
      eqDistrict(c.district, district) &&
      c.transferredToReferralHospital) ||
    (role === 'CHW' && c.reportedByUserId === userId);
  if (!can) throw new HttpError(403, 'Forbidden');

  if (role === 'HOSPITAL' && c.transferredToReferralHospital) {
    throw new HttpError(
      403,
      'This case was transferred to referral hospital. District record is read-only.'
    );
  }

  const safeInput = sanitizePatchForRole(role, input);
  const patch = buildPatchCaseData(safeInput);
  if (Object.keys(patch).length === 0 && !safeInput.timelineEvent) {
    return getCaseByRef(caseRef, role, userId, district);
  }

  const prevSnapshot = { ...c };

  const updated = await prisma.$transaction(async (tx) => {
    if (safeInput.timelineEvent) {
      await tx.caseTimelineEntry.create({
        data: {
          caseId: c.id,
          event: safeInput.timelineEvent.event,
          actorName: safeInput.timelineEvent.actorName,
          actorRole: safeInput.timelineEvent.actorRole,
        },
      });
    }
    if (Object.keys(patch).length > 0) {
      return tx.case.update({
        where: { id: c.id },
        data: patch as object,
        include: { timeline: { orderBy: { createdAt: 'asc' } } },
      });
    }
    return tx.case.findUniqueOrThrow({
      where: { id: c.id },
      include: { timeline: { orderBy: { createdAt: 'asc' } } },
    });
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });

  void actorName;
  await emitCaseTransitionNotifications(prevSnapshot, updated);

  return mapCaseToApiForViewer(updated, role);
}

export async function statsOverview(role: UserRole, userId: string, district: string) {
  const where = listWhereForRole(role, userId, district);
  const [total, byStatus] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
  ]);
  const deaths = await prisma.case.count({
    where: { ...where, status: 'Deceased' },
  });
  const eidsr = await prisma.case.count({
    where: { ...where, reportedToEIDSR: true },
  });
  let byDistrict: Record<string, number> | undefined;
  if (role === 'ADMIN' || role === 'RICH' || role === 'PFTH' || role === 'SFR') {
    const grouped = await prisma.case.groupBy({
      by: ['district'],
      where,
      _count: true,
    });
    byDistrict = Object.fromEntries(
      grouped.map((x) => [x.district, x._count])
    );
  }

  return {
    totalCases: total,
    deathsLogged: deaths,
    reportedToEIDSR: eidsr,
    byStatus: Object.fromEntries(
      byStatus.map((x) => [mapCaseStatusToApi(x.status), x._count])
    ),
    ...(byDistrict ? { byDistrict } : {}),
  };
}

/** CSV export for Admin / RICH — full case projection (no role redaction). */
export async function exportCasesCsv(
  role: UserRole,
  userId: string,
  district: string
) {
  if (
    role !== 'ADMIN' &&
    role !== 'RICH' &&
    role !== 'PFTH' &&
    role !== 'SFR'
  ) {
    throw new HttpError(403, 'Forbidden');
  }
  const where = listWhereForRole(role, userId, district);
  const rows = await prisma.case.findMany({
    where,
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
  const headers = [
    'id',
    'province',
    'district',
    'sector',
    'patientName',
    'patientCode',
    'status',
    'symptoms',
    'severeMalariaTestResult',
    'finalOutcomeHospital',
    'createdAt',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const api = mapCaseToApi(r);
    const vals = headers.map((h) => {
      const v = api[h];
      if (v === undefined || v === null) return '""';
      if (Array.isArray(v)) return `"${String(v.join('; ')).replace(/"/g, '""')}"`;
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}
