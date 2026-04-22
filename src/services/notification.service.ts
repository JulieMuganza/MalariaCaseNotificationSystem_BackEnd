import type {
  Case,
  ChwReferralTransport,
  HcReferralTransport,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { mapNotificationToApi } from '../mappers/notification.mapper.js';
import { notificationTargetMatchesUser } from '../utils/role.js';
import {
  richCaseProvinceWhere,
  pfthCaseProvinceWhere,
  sfrCaseProvinceWhere,
  surveillanceTargetForProvince,
} from '../utils/surveillancePartner.js';
import { CHAT_TITLES } from './message.service.js';

/** Notifications for first-line facility (CHW referral destination). */
function firstLineTargetRole(c: Pick<Case, 'chwPrimaryReferral'>): 'HEALTH_CENTER' | 'LOCAL_CLINIC' {
  return c.chwPrimaryReferral === 'LOCAL_CLINIC' ? 'LOCAL_CLINIC' : 'HEALTH_CENTER';
}

function patientCodeDisplay(c: Case): string {
  return c.patientCode || c.patientId;
}

function fmtChwTransport(t: ChwReferralTransport | null | undefined): string {
  if (!t) return '—';
  if (t === 'With_CHW') return 'With CHW';
  if (t === 'Self') return 'Walk';
  return t;
}

function fmtHcTransport(t: HcReferralTransport | null | undefined): string {
  if (!t) return '—';
  if (t === 'With_relative') return 'With relative';
  if (t === 'Walk' || t === 'Bicycle') return 'Self';
  if (t === 'Motor') return 'With relative';
  if (t === 'Car_Bus') return 'Ambulance';
  return t;
}

function locationLine(c: Case): string {
  return `${c.province}, ${c.district}, ${c.sector} — ${c.cell}, ${c.village}`;
}

function symptomsLine(c: Case): string {
  return c.symptoms.length > 0 ? c.symptoms.join(', ') : '—';
}

function hcPreTreatmentLine(c: Case): string {
  const t = c.hcPreTreatment?.filter(Boolean) ?? [];
  return t.length > 0 ? t.join(', ') : '—';
}

function referringHealthCenterName(c: Case): string {
  const h = c.healthCenter?.trim();
  if (h) return h;
  return c.chwName?.trim() || '—';
}

function extractLineValue(message: string, key: string): string | null {
  const line = message
    .split('\n')
    .find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!line) return null;
  const value = line.slice(line.indexOf(':') + 1).trim();
  return value || null;
}

function patchHealthCenterName(
  message: string,
  caseHealthCenterName?: string | null,
  viewerFacilityName?: string | null
): string {
  const facility = caseHealthCenterName?.trim() || viewerFacilityName?.trim();
  if (!facility) return message;

  const lines = message.split('\n');
  const hcLineIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith('health center name:')
  );
  if (hcLineIdx < 0) return message;

  const currentHealthCenter = extractLineValue(message, 'Health center name') ?? '';
  const chwName = extractLineValue(message, 'CHW') ?? '';
  const shouldReplace =
    !currentHealthCenter ||
    currentHealthCenter === '—' ||
    (chwName &&
      currentHealthCenter.localeCompare(chwName, undefined, {
        sensitivity: 'accent',
      }) === 0);

  if (!shouldReplace) return message;
  lines[hcLineIdx] = `Health center name: ${facility}`;
  return lines.join('\n');
}

function patchDistrictHospitalName(
  message: string,
  caseDistrictHospitalName?: string | null,
  caseDistrict?: string | null,
  viewerFacilityName?: string | null
): string {
  const districtFallback = caseDistrict?.trim()
    ? `${caseDistrict.trim()} District Hospital`
    : null;
  const facility =
    caseDistrictHospitalName?.trim() ||
    viewerFacilityName?.trim() ||
    districtFallback;
  if (!facility) return message;

  const lines = message.split('\n');
  const dhLineIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith('district hosp name:')
  );
  if (dhLineIdx < 0) return message;

  const currentDistrictHospital = extractLineValue(message, 'District hosp name') ?? '';
  const districtLabel = caseDistrict?.trim()
    ? `${caseDistrict.trim()} District Hospital`
    : null;
  const shouldReplace =
    !currentDistrictHospital ||
    currentDistrictHospital === '—' ||
    currentDistrictHospital === 'District Hospital' ||
    (districtLabel !== null &&
      currentDistrictHospital.localeCompare(districtLabel, undefined, {
        sensitivity: 'accent',
      }) === 0 &&
      currentDistrictHospital.localeCompare(facility, undefined, {
        sensitivity: 'accent',
      }) !== 0);
  if (!shouldReplace) return message;

  lines[dhLineIdx] = `District hosp name: ${facility}`;
  return lines.join('\n');
}

function districtHospitalNameFromCaseShape(c: {
  hospital?: string | null;
  timeline?: { actorName: string; actorRole: string }[];
}): string | null {
  const explicit = c.hospital?.trim();
  if (explicit) return explicit;

  const byDistrictRole = c.timeline
    ?.slice()
    .reverse()
    .find((t) => /district hospital/i.test(t.actorRole) && t.actorName?.trim());
  if (byDistrictRole?.actorName?.trim()) return byDistrictRole.actorName.trim();

  const byHospitalRole = c.timeline
    ?.slice()
    .reverse()
    .find(
      (t) =>
        /hospital/i.test(t.actorRole) &&
        !/referral/i.test(t.actorRole) &&
        t.actorName?.trim()
    );
  if (byHospitalRole?.actorName?.trim()) return byHospitalRole.actorName.trim();

  return null;
}

/**
 * Unified notification body (same shape as Dist Hsp→Referral): route, facility, patient,
 * demographics, treatment, symptoms, transport; optional extra lines for surveillance/detail.
 */
export function buildStructuredCaseNotification(opts: {
  route: string;
  facilityLine: string;
  prePatientLines?: string[];
  patientName: string;
  patientCode: string;
  sex: string;
  age: number | string;
  treatment: string;
  symptoms: string;
  howCame: string;
  tailLines?: string[];
}): string {
  return [
    opts.route,
    opts.facilityLine,
    ...(opts.prePatientLines ?? []),
    `Patient name: ${opts.patientName}`,
    `Patient code: ${opts.patientCode}`,
    `Gender: ${opts.sex}`,
    `Age: ${opts.age}`,
    `Treatment: ${opts.treatment}`,
    `Symptoms: ${opts.symptoms}`,
    `How he came: ${opts.howCame}`,
    ...(opts.tailLines ?? []),
  ].join('\n');
}

export function buildChwToHcPartialSummary(c: Case, chwPhone?: string | null): string {
  const code = patientCodeDisplay(c);
  const rdt = c.chwRapidTestResult ?? 'Positive';
  return buildStructuredCaseNotification({
    route: 'CHW->Health Center',
    facilityLine: `Health center name: ${referringHealthCenterName(c)}`,
    prePatientLines: [`CHW: ${c.chwName}`, `Phone: ${chwPhone?.trim() || '—'}`],
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: `RDT ${rdt}`,
    symptoms: symptomsLine(c),
    howCame: fmtChwTransport(c.chwReferralTransport),
  });
}

export function buildChwToRichFullSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  return buildStructuredCaseNotification({
    route: 'CHW->Health Center (surveillance)',
    facilityLine: `Health center name: ${referringHealthCenterName(c)}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: `RDT ${c.chwRapidTestResult ?? 'Positive'}`,
    symptoms: symptomsLine(c),
    howCame: fmtChwTransport(c.chwReferralTransport),
    tailLines: [
      `CHW: ${c.chwName}`,
      `District: ${c.district}`,
      `Location: ${locationLine(c)}`,
    ],
  });
}

/** HC → District Hospital — short inbox line (same tone as other alerts). */
export function buildHcToHospitalPartialSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  return buildStructuredCaseNotification({
    route: 'HC->District Hospital',
    facilityLine: `Health center name: ${referringHealthCenterName(c)}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: hcPreTreatmentLine(c),
    symptoms: symptomsLine(c),
    howCame: fmtHcTransport(c.hcReferralToHospitalTransport),
    tailLines: ['Open Clinical management to receive.'],
  });
}

/** HC → RICH when referring to hospital (compact; full detail in case record). */
export function buildHcReferralToRichFullSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  return buildStructuredCaseNotification({
    route: 'HC->District Hospital (surveillance)',
    facilityLine: `Health center name: ${referringHealthCenterName(c)}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: hcPreTreatmentLine(c),
    symptoms: symptomsLine(c),
    howCame: fmtHcTransport(c.hcReferralToHospitalTransport),
    tailLines: [`District: ${c.district}`, `Location: ${locationLine(c)}`],
  });
}

/** District Hospital → Referral Hospital: handoff identity + short management summary (no full symptom list). */
export function buildDhToReferralPartialSummary(c: Case): string {
  const hospitalName = c.hospital?.trim() || 'District Hospital';
  const code = patientCodeDisplay(c);
  return buildStructuredCaseNotification({
    route: 'Dist Hsp->Referral',
    facilityLine: `District hosp name: ${hospitalName}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: c.hospitalManagementMedication?.trim() || '—',
    symptoms: symptomsLine(c),
    howCame: fmtHcTransport(c.dhReferralToReferralHospitalTransport),
  });
}

/** RICH when DH escalates to referral hospital. */
export function buildDhToReferralRichFullSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  const mg = c.hospitalManagementMedication?.trim()
    ? c.hospitalManagementMedication.length > 240
      ? `${c.hospitalManagementMedication.slice(0, 240)}…`
      : c.hospitalManagementMedication
    : '—';
  const toRh = fmtHcTransport(c.dhReferralToReferralHospitalTransport);
  return buildStructuredCaseNotification({
    route: 'Dist Hsp->Referral (surveillance)',
    facilityLine: `District hosp name: ${c.hospital?.trim() || 'District Hospital'}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: mg,
    symptoms: symptomsLine(c),
    howCame: toRh,
    tailLines: [
      `Severe malaria test: ${c.severeMalariaTestResult ?? '—'}`,
      `District: ${c.district}`,
      `Location: ${locationLine(c)}`,
    ],
  });
}

export function buildHospitalSevereTestRichSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  const r = c.severeMalariaTestResult ?? '—';
  const mg = c.hospitalManagementMedication?.trim()
    ? c.hospitalManagementMedication
    : '—';
  return buildStructuredCaseNotification({
    route: 'Severe malaria test updated',
    facilityLine: `District hosp name: ${c.hospital?.trim() || 'District Hospital'}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: mg,
    symptoms: symptomsLine(c),
    howCame: '—',
    tailLines: [`Test result: ${r}`, `District: ${c.district}`],
  });
}

/** Phase retour to HC & CHW: positive case, partial — no management block. */
export function buildRetourPartialForCommunity(c: Case): string {
  const code = patientCodeDisplay(c);
  const out = c.finalOutcomeHospital ?? '—';
  const dis = c.hospitalDischargeDateTime
    ? c.hospitalDischargeDateTime.toLocaleString()
    : '—';
  const mg = c.hospitalManagementMedication?.trim() || '—';
  return buildStructuredCaseNotification({
    route: 'Patient discharged (retour)',
    facilityLine: `District hosp name: ${c.hospital?.trim() || 'District Hospital'}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: mg,
    symptoms: symptomsLine(c),
    howCame: 'Discharged from facility',
    tailLines: [
      `Severe malaria test: ${c.severeMalariaTestResult ?? '—'}`,
      `Outcome: ${out}`,
      `Discharge: ${dis}`,
    ],
  });
}

export function buildRetourFullForRich(c: Case): string {
  const code = patientCodeDisplay(c);
  const mg = c.hospitalManagementMedication?.trim()
    ? c.hospitalManagementMedication
    : '—';
  const dis = c.hospitalDischargeDateTime
    ? c.hospitalDischargeDateTime.toLocaleString()
    : '—';
  return buildStructuredCaseNotification({
    route: 'Patient discharged (surveillance)',
    facilityLine: `District hosp name: ${c.hospital?.trim() || 'District Hospital'}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: mg,
    symptoms: symptomsLine(c),
    howCame: 'Discharged from facility',
    tailLines: [
      `Severe malaria test: ${c.severeMalariaTestResult ?? '—'}`,
      `Outcome: ${c.finalOutcomeHospital ?? '—'}`,
      `Discharge: ${dis}`,
      `District: ${c.district}`,
      `Location: ${locationLine(c)}`,
    ],
  });
}

function buildDeathOutcomeSummary(c: Case): string {
  const code = patientCodeDisplay(c);
  return buildStructuredCaseNotification({
    route: 'Outcome: deceased',
    facilityLine: `District hosp name: ${c.hospital?.trim() || '—'}`,
    patientName: c.patientName,
    patientCode: code,
    sex: c.sex,
    age: c.age,
    treatment: '—',
    symptoms: symptomsLine(c),
    howCame: '—',
    tailLines: [`District: ${c.district}`],
  });
}

/** After PATCH: compare persisted rows and enqueue notifications. */
export async function emitCaseTransitionNotifications(
  prev: Case,
  next: Case
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (
    !prev.hcPatientTransferredToHospitalDateTime &&
    next.hcPatientTransferredToHospitalDateTime
  ) {
    tasks.push(
      prisma.notification.createMany({
        data: [
          {
            type: 'alert',
            title: 'New referral from health center',
            message: buildHcToHospitalPartialSummary(next),
            caseRef: next.caseRef,
            targetRole: 'HOSPITAL',
            phase: 'aller',
            contentLevel: 'partial',
            recipientRoles: 'District hospital triage / admissions',
            malariaCaseId: next.id,
          },
          {
            type: 'alert',
            title: 'New HC referral (surveillance)',
            message: buildHcReferralToRichFullSummary(next),
            caseRef: next.caseRef,
            targetRole: surveillanceTargetForProvince(next.province),
            phase: 'aller',
            contentLevel: 'full',
            malariaCaseId: next.id,
          },
        ],
      })
    );
  }

  if (
    !prev.dhTransferredToReferralHospitalDateTime &&
    next.dhTransferredToReferralHospitalDateTime
  ) {
    tasks.push(
      prisma.notification.createMany({
        data: [
          {
            type: 'alert',
            title: 'Dist Hsp->Referral',
            message: buildDhToReferralPartialSummary(next),
            caseRef: next.caseRef,
            targetRole: 'REFERRAL_HOSPITAL',
            phase: 'aller',
            contentLevel: 'partial',
            recipientRoles: 'Referral / provincial hospital admissions',
            malariaCaseId: next.id,
          },
          {
            type: 'alert',
            title: 'Referral escalation (surveillance)',
            message: buildDhToReferralRichFullSummary(next),
            caseRef: next.caseRef,
            targetRole: surveillanceTargetForProvince(next.province),
            phase: 'aller',
            contentLevel: 'full',
            malariaCaseId: next.id,
          },
        ],
      })
    );
  }

  if (!prev.severeMalariaTestResult && next.severeMalariaTestResult) {
    tasks.push(
      prisma.notification.create({
        data: {
          type: 'info',
          title: 'Severe malaria test updated',
          message: buildHospitalSevereTestRichSummary(next),
          caseRef: next.caseRef,
          targetRole: surveillanceTargetForProvince(next.province),
          phase: next.severeMalariaTestResult === 'Positive' ? 'retour' : 'aller',
          contentLevel: 'full',
          malariaCaseId: next.id,
        },
      })
    );
  }

  if (
    next.severeMalariaTestResult === 'Positive' &&
    next.hospitalDischargeDateTime &&
    !prev.hospitalDischargeDateTime &&
    next.reportedByUserId
  ) {
    const partialMsg = buildRetourPartialForCommunity(next);
    tasks.push(
      prisma.notification.createMany({
        data: [
          {
            type: 'success',
            title: 'Patient discharged — health center',
            message: partialMsg,
            caseRef: next.caseRef,
            targetRole: firstLineTargetRole(next),
            phase: 'retour',
            contentLevel: 'partial',
            malariaCaseId: next.id,
          },
          {
            type: 'success',
            title: 'Patient discharged — CHW',
            message: partialMsg,
            caseRef: next.caseRef,
            targetRole: 'CHW',
            phase: 'retour',
            contentLevel: 'partial',
            userId: next.reportedByUserId,
            malariaCaseId: next.id,
          },
        ],
      })
    );
    tasks.push(
      prisma.notification.create({
        data: {
          type: 'success',
          title: 'Patient discharged (surveillance)',
          message: buildRetourFullForRich(next),
          caseRef: next.caseRef,
          targetRole: surveillanceTargetForProvince(next.province),
          phase: 'retour',
          contentLevel: 'full',
          malariaCaseId: next.id,
        },
      })
    );
  }

  if (prev.status !== 'Deceased' && next.status === 'Deceased') {
    const deathMsg = buildDeathOutcomeSummary(next);
    const deathRows: Prisma.NotificationCreateManyInput[] = [
      {
        type: 'warning',
        title: 'Patient deceased (surveillance)',
        message: deathMsg,
        caseRef: next.caseRef,
        targetRole: surveillanceTargetForProvince(next.province),
        phase: 'retour',
        contentLevel: 'full',
        malariaCaseId: next.id,
      },
      {
        type: 'warning',
        title: 'Patient deceased',
        message: deathMsg,
        caseRef: next.caseRef,
        targetRole: firstLineTargetRole(next),
        phase: 'retour',
        contentLevel: 'partial',
        malariaCaseId: next.id,
      },
    ];
    if (next.reportedByUserId) {
      deathRows.push({
        type: 'warning',
        title: 'Patient deceased',
        message: deathMsg,
        caseRef: next.caseRef,
        targetRole: 'CHW',
        phase: 'retour',
        contentLevel: 'partial',
        malariaCaseId: next.id,
        userId: next.reportedByUserId,
      });
    }
    tasks.push(
      prisma.notification.createMany({
        data: deathRows,
      })
    );
  }

  await Promise.all(tasks);
}

export async function createNotificationsForNewCase(
  caseRow: Case,
  reporter: { name: string; phone?: string | null }
) {
  const firstLine = firstLineTargetRole(caseRow);
  await prisma.notification.createMany({
    data: [
      {
        type: 'alert',
        title: 'New case from CHW',
        message: buildChwToHcPartialSummary(caseRow, reporter.phone),
        caseRef: caseRow.caseRef,
        targetRole: firstLine,
        phase: 'aller',
        contentLevel: 'partial',
        recipientRoles:
          firstLine === 'LOCAL_CLINIC'
            ? 'Local clinic staff'
            : 'CHEO, Head Health Center (Titulaire)',
        malariaCaseId: caseRow.id,
      },
      {
        type: 'alert',
        title: 'New CHW notification (surveillance)',
        message: buildChwToRichFullSummary(caseRow),
        caseRef: caseRow.caseRef,
        targetRole: surveillanceTargetForProvince(caseRow.province),
        phase: 'aller',
        contentLevel: 'full',
        malariaCaseId: caseRow.id,
      },
    ],
  });
}

/** Shown to all Health Center users in the case district (new registration at facility). */
export async function createHcFacilityCaseNotification(
  caseRow: Case,
  registeredByName: string
) {
  const code = patientCodeDisplay(caseRow);
  const atLocal = caseRow.chwPrimaryReferral === 'LOCAL_CLINIC';
  const msg = buildStructuredCaseNotification({
    route: atLocal
      ? 'New registration at local clinic'
      : 'New registration at health center',
    facilityLine: atLocal
      ? `Local clinic name: ${referringHealthCenterName(caseRow)}`
      : `Health center name: ${referringHealthCenterName(caseRow)}`,
    patientName: caseRow.patientName,
    patientCode: code,
    sex: caseRow.sex,
    age: caseRow.age,
    treatment: hcPreTreatmentLine(caseRow),
    symptoms: symptomsLine(caseRow),
    howCame: caseRow.transportMode?.trim() || fmtHcTransport(caseRow.hcReferralToHospitalTransport),
    tailLines: [`Registered by: ${registeredByName}`, `Case ref: ${caseRow.caseRef}`],
  });
  await prisma.notification.create({
    data: {
      type: 'success',
      title: atLocal ? 'New registration at local clinic' : 'New registration at health center',
      message: msg,
      caseRef: caseRow.caseRef,
      targetRole: firstLineTargetRole(caseRow),
      phase: 'aller',
      contentLevel: 'partial',
      malariaCaseId: caseRow.id,
    },
  });
}

export async function createNotificationsForHcNewCase(
  caseRow: Case,
  senderName: string
) {
  const code = patientCodeDisplay(caseRow);
  const dhMsg = buildStructuredCaseNotification({
    route: 'HC walk-in / new case (to district hospital)',
    facilityLine: `Health center name: ${referringHealthCenterName(caseRow)}`,
    patientName: caseRow.patientName,
    patientCode: code,
    sex: caseRow.sex,
    age: caseRow.age,
    treatment: hcPreTreatmentLine(caseRow),
    symptoms: symptomsLine(caseRow),
    howCame: fmtHcTransport(caseRow.hcReferralToHospitalTransport),
    tailLines: [`Registered by: ${senderName}`],
  });
  const richMsg = buildStructuredCaseNotification({
    route: 'HC walk-in / new case (surveillance)',
    facilityLine: `Health center name: ${referringHealthCenterName(caseRow)}`,
    patientName: caseRow.patientName,
    patientCode: code,
    sex: caseRow.sex,
    age: caseRow.age,
    treatment: hcPreTreatmentLine(caseRow),
    symptoms: symptomsLine(caseRow),
    howCame: fmtHcTransport(caseRow.hcReferralToHospitalTransport),
    tailLines: [
      `Registered by: ${senderName}`,
      `District: ${caseRow.district}`,
      `Location: ${locationLine(caseRow)}`,
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        type: 'alert',
        title: 'New case at health center (referral)',
        message: dhMsg,
        caseRef: caseRow.caseRef,
        targetRole: 'HOSPITAL',
        phase: 'aller',
        contentLevel: 'partial',
        malariaCaseId: caseRow.id,
      },
      {
        type: 'alert',
        title: 'New HC case (surveillance)',
        message: richMsg,
        caseRef: caseRow.caseRef,
        targetRole: surveillanceTargetForProvince(caseRow.province),
        phase: 'aller',
        contentLevel: 'full',
        malariaCaseId: caseRow.id,
      },
    ],
  });
}

/** Align user.district with case.district (trim + case-insensitive) so HC/DH inboxes are not empty. */
function districtEquals(district: string) {
  const t = district.trim();
  if (!t) return null;
  return { equals: t, mode: 'insensitive' as const };
}

/** Shared inbox filter (excludes chat pseudo-notifications). Used by list + mark-all-read. */
export function buildNotificationInboxWhere(
  role: UserRole,
  userId: string,
  district: string
): Prisma.NotificationWhereInput {
  const dEq = districtEquals(district);
  const where: Prisma.NotificationWhereInput =
    role === 'ADMIN'
      ? {}
      : role === 'RICH'
        ? {
            targetRole: 'RICH' as const,
            malariaCase: { is: richCaseProvinceWhere() },
          }
        : role === 'PFTH'
          ? {
              targetRole: 'PFTH' as const,
              malariaCase: { is: pfthCaseProvinceWhere() },
            }
          : role === 'SFR'
            ? {
                targetRole: 'SFR' as const,
                malariaCase: { is: sfrCaseProvinceWhere() },
              }
            : role === 'CHW'
              ? {
                  targetRole: 'CHW' as const,
                  OR: [{ userId: null }, { userId }],
                }
              : role === 'HEALTH_CENTER'
                ? dEq
                  ? {
                      targetRole: 'HEALTH_CENTER' as const,
                      malariaCase: {
                        is: {
                          district: dEq,
                          chwPrimaryReferral: 'HEALTH_CENTER',
                          OR: [
                            { symptomCount: { gt: 0 } },
                            { hcPatientReceivedDateTime: { not: null } },
                            { hcPatientTransferredToHospitalDateTime: { not: null } },
                          ],
                        },
                      },
                    }
                  : { targetRole: 'HEALTH_CENTER' as const, id: { in: [] } }
                : role === 'LOCAL_CLINIC'
                  ? dEq
                    ? {
                        targetRole: 'LOCAL_CLINIC' as const,
                        malariaCase: {
                          is: {
                            district: dEq,
                            chwPrimaryReferral: 'LOCAL_CLINIC',
                            OR: [
                              { symptomCount: { gt: 0 } },
                              { hcPatientReceivedDateTime: { not: null } },
                              { hcPatientTransferredToHospitalDateTime: { not: null } },
                            ],
                          },
                        },
                      }
                    : { targetRole: 'LOCAL_CLINIC' as const, id: { in: [] } }
                  : role === 'HOSPITAL'
                    ? dEq
                      ? {
                          targetRole: 'HOSPITAL' as const,
                          malariaCase: {
                            is: { district: dEq },
                          },
                        }
                      : { targetRole: 'HOSPITAL' as const, id: { in: [] } }
                    : role === 'REFERRAL_HOSPITAL'
                      ? dEq
                        ? {
                            targetRole: 'REFERRAL_HOSPITAL' as const,
                            malariaCase: {
                              is: { district: dEq },
                            },
                          }
                        : { targetRole: 'REFERRAL_HOSPITAL' as const, id: { in: [] } }
                      : { targetRole: role };
  return {
    ...where,
    title: {
      notIn: [...CHAT_TITLES],
    },
  };
}

export async function listNotificationsForUser(
  role: UserRole,
  userId: string,
  district: string
) {
  const viewerName =
    role === 'HEALTH_CENTER' || role === 'LOCAL_CLINIC'
      ? (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          })
        )?.name ?? null
      : null;
  const viewerDistrictHospitalName =
    role === 'HOSPITAL'
      ? (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          })
        )?.name ?? null
      : null;
  const whereWithoutChat = buildNotificationInboxWhere(role, userId, district);
  const take =
    role === 'ADMIN' ||
    role === 'RICH' ||
    role === 'PFTH' ||
    role === 'SFR'
      ? 500
      : 200;
  const rows = await prisma.notification.findMany({
    where: whereWithoutChat as Prisma.NotificationWhereInput,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      malariaCase: {
        include: {
          timeline: {
            orderBy: { createdAt: 'asc' },
            select: { actorName: true, actorRole: true },
          },
        },
      },
    },
  });
  const normalized = rows.map((n) => {
    if (
      role === 'HEALTH_CENTER' &&
      n.targetRole === 'HEALTH_CENTER' &&
      n.phase === 'aller' &&
      n.malariaCase &&
      (n.title.includes('CHW') || n.recipientRoles?.includes('CHEO'))
    ) {
      const parsedPhone = extractLineValue(n.message, 'Phone');
      const chwPhone = parsedPhone && parsedPhone !== '—' ? parsedPhone : undefined;
      const rebuilt = buildChwToHcPartialSummary(n.malariaCase, chwPhone);
      return {
        ...n,
        title: 'New case from CHW',
        message: patchHealthCenterName(
          rebuilt,
          n.malariaCase.healthCenter,
          viewerName
        ),
      };
    }
    if (
      role === 'LOCAL_CLINIC' &&
      n.targetRole === 'LOCAL_CLINIC' &&
      n.phase === 'aller' &&
      n.malariaCase &&
      !n.message.includes('Phone:') &&
      (n.title.includes('CHW') || n.recipientRoles?.includes('Local clinic'))
    ) {
      return {
        ...n,
        title: 'New case from CHW',
        message: patchHealthCenterName(
          buildChwToHcPartialSummary(n.malariaCase),
          n.malariaCase.healthCenter,
          viewerName
        ),
      };
    }
    if (
      !n.malariaCase ||
      (!n.message.includes('Health center name:') &&
        !n.message.includes('District hosp name:'))
    ) {
      return n;
    }
    const patchedHealthCenterMessage = patchHealthCenterName(
      n.message,
      n.malariaCase.healthCenter,
      viewerName
    );
    const patchedDistrictHospitalMessage = patchDistrictHospitalName(
      patchedHealthCenterMessage,
      districtHospitalNameFromCaseShape(n.malariaCase),
      n.malariaCase.district,
      viewerDistrictHospitalName
    );
    return {
      ...n,
      message: patchedDistrictHospitalMessage,
    };
  });
  return normalized.map(mapNotificationToApi);
}

export async function markNotificationRead(
  id: string,
  role: UserRole,
  userId: string
) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) throw new HttpError(404, 'Notification not found');
  if (
    role !== 'ADMIN' &&
    !notificationTargetMatchesUser(n.targetRole, role)
  ) {
    throw new HttpError(403, 'Forbidden');
  }
  if (
    role === 'CHW' &&
    n.targetRole === 'CHW' &&
    n.userId &&
    n.userId !== userId
  ) {
    throw new HttpError(403, 'Forbidden');
  }
  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return mapNotificationToApi(updated);
}

/** Mark every unread notification in this user's inbox as read (same scope as list). */
export async function markAllNotificationsRead(
  role: UserRole,
  userId: string,
  district: string
): Promise<{ count: number }> {
  const where = buildNotificationInboxWhere(role, userId, district);
  const result = await prisma.notification.updateMany({
    where: {
      ...where,
      read: false,
    },
    data: { read: true },
  });
  return { count: result.count };
}
