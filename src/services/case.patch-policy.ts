import type { UserRole } from '@prisma/client';
import type { PatchCaseInput } from '../validators/case.schemas.js';

type PatchKey = keyof PatchCaseInput;

const TRANSFER_DH_TO_RH: PatchKey[] = [
  'transferredToReferralHospital',
  'dhTransferredToReferralHospitalDateTime',
  'dhReferralToReferralHospitalTransport',
];

const ADMIN_KEYS: PatchKey[] = [
  'status',
  'testType',
  'plasmodiumSpecies',
  'confirmedDate',
  'caseCategory',
  'vulnerabilities',
  'hospitalChecklist',
  'outcome',
  'outcomeDate',
  'outcomeNotes',
  'reportedToEIDSR',
  'hcPatientReceivedDateTime',
  'hcPatientTransferredToHospitalDateTime',
  'hcReferralToHospitalTransport',
  'hcPreTreatment',
  'symptoms',
  'hospitalReceivedDateTime',
  'hospitalDischargeDateTime',
  'severeMalariaTestResult',
  'hospitalManagementMedication',
  'finalOutcomeHospital',
  'phaseRetourEligible',
  'healthCenter',
  'hospital',
  'transferredToReferralHospital',
  'dhTransferredToReferralHospitalDateTime',
  'dhReferralToReferralHospitalTransport',
  'referralHospitalReceivedDateTime',
  'dhHcPreTransferReceived',
  'dhObservationPlannedDays',
  'dhObservationStartedAt',
  'dhOralTreatmentReadyAt',
  'referralContinuityAcknowledgedAt',
  'referralSymptomsUpdate',
  'referralClinicalTrend',
  'referralSpecializedCareUnit',
  'referralSpecializedCareAt',
  'referralInpatientNotes',
  'timelineEvent',
  'transportMode',
];

const HC_KEYS: PatchKey[] = [
  'status',
  'testType',
  'plasmodiumSpecies',
  'confirmedDate',
  'caseCategory',
  'vulnerabilities',
  'reportedToEIDSR',
  'hcPatientReceivedDateTime',
  'hcPatientTransferredToHospitalDateTime',
  'hcReferralToHospitalTransport',
  'hcPreTreatment',
  'symptoms',
  'severeMalariaTestResult',
  'timelineEvent',
  'transportMode',
];

/** Local clinic: same HC workflow except no severe-malaria diagnostic (TDR) capture at this tier. */
const LOCAL_CLINIC_KEYS: PatchKey[] = HC_KEYS.filter(
  (k) => k !== 'severeMalariaTestResult'
);

/** District hospital (Prisma HOSPITAL) — includes escalation to referral hospital. */
const DISTRICT_HOSPITAL_KEYS: PatchKey[] = [
  'status',
  'testType',
  'plasmodiumSpecies',
  'confirmedDate',
  'caseCategory',
  'vulnerabilities',
  'hospitalChecklist',
  'outcome',
  'outcomeDate',
  'outcomeNotes',
  'reportedToEIDSR',
  'hospitalReceivedDateTime',
  'hospitalDischargeDateTime',
  'severeMalariaTestResult',
  'hospitalManagementMedication',
  'finalOutcomeHospital',
  'phaseRetourEligible',
  'hcPreTreatment',
  'dhHcPreTransferReceived',
  'dhObservationPlannedDays',
  'dhObservationStartedAt',
  'dhOralTreatmentReadyAt',
  ...TRANSFER_DH_TO_RH,
  'timelineEvent',
];

/** Referral / provincial hospital — same clinical patch as district, no DH→RH transfer fields. */
const REFERRAL_HOSPITAL_KEYS: PatchKey[] = [
  'status',
  'testType',
  'plasmodiumSpecies',
  'confirmedDate',
  'caseCategory',
  'vulnerabilities',
  'hospitalChecklist',
  'outcome',
  'outcomeDate',
  'outcomeNotes',
  'reportedToEIDSR',
  'hospitalReceivedDateTime',
  'hospitalDischargeDateTime',
  'severeMalariaTestResult',
  'hospitalManagementMedication',
  'finalOutcomeHospital',
  'phaseRetourEligible',
  'dhHcPreTransferReceived',
  'dhObservationPlannedDays',
  'dhObservationStartedAt',
  'dhOralTreatmentReadyAt',
  'referralHospitalReceivedDateTime',
  'referralContinuityAcknowledgedAt',
  'referralSymptomsUpdate',
  'referralClinicalTrend',
  'referralSpecializedCareUnit',
  'referralSpecializedCareAt',
  'referralInpatientNotes',
  'timelineEvent',
];

const CHW_KEYS: PatchKey[] = ['vulnerabilities', 'timelineEvent'];

const BY_ROLE: Record<UserRole, PatchKey[]> = {
  ADMIN: ADMIN_KEYS,
  HEALTH_CENTER: HC_KEYS,
  LOCAL_CLINIC: LOCAL_CLINIC_KEYS,
  HOSPITAL: DISTRICT_HOSPITAL_KEYS,
  REFERRAL_HOSPITAL: REFERRAL_HOSPITAL_KEYS,
  CHW: CHW_KEYS,
  RICH: [],
  PFTH: [],
  SFR: [],
};

export function sanitizePatchForRole(
  role: UserRole,
  input: PatchCaseInput
): PatchCaseInput {
  const allowed = new Set(BY_ROLE[role] ?? []);
  if (allowed.size === 0) return {};
  const out: PatchCaseInput = {};
  for (const key of allowed) {
    const v = input[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
