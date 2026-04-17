import type {
  CaseStatus,
  PlasmodiumSpecies,
  CaseCategory,
  HospitalOutcome,
  FinalOutcomeHospital,
  ChwReferralTransport,
  HcReferralTransport,
  SevereMalariaTestResult,
  UserRole,
  ChwPrimaryReferral,
} from '@prisma/client';
import type { CreateCaseInput, PatchCaseInput } from '../validators/case.schemas.js';
import { provinceFromDistrict } from '../data/rwandaProvince.js';

export function parseDateFlexible(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return new Date(s);
}

export function apiCaseStatusToPrisma(s: string): CaseStatus {
  if (s === 'HC Received') return 'HC_Received';
  return s as CaseStatus;
}

export function prismaCaseStatusFromApiString(s: string): CaseStatus {
  return apiCaseStatusToPrisma(s);
}

export function apiPlasmodiumToPrisma(
  s: string | undefined
): PlasmodiumSpecies | undefined {
  if (!s) return undefined;
  if (s === 'Not specified') return 'Not_specified';
  return s as PlasmodiumSpecies;
}

export function apiCaseCategoryToPrisma(
  s: 'Index case' | 'Follow-up case' | undefined
): CaseCategory | undefined {
  if (!s) return undefined;
  return s === 'Index case' ? 'Index_case' : 'Follow_up_case';
}

export function apiHospitalOutcomeToPrisma(
  s: string | undefined
): HospitalOutcome | undefined {
  if (!s) return undefined;
  const m: Record<string, HospitalOutcome> = {
    'Treated & Discharged': 'Treated_Discharged',
    'Still Admitted': 'Still_Admitted',
    'Referred further': 'Referred_further',
    Deceased: 'Deceased',
  };
  return m[s];
}

export function apiChwTransportToPrisma(
  s: 'Self' | 'With CHW' | 'Ambulance' | undefined
): ChwReferralTransport | undefined {
  if (!s) return undefined;
  if (s === 'With CHW') return 'With_CHW';
  return s as ChwReferralTransport;
}

export function apiHcTransportToPrisma(
  s: 'Self' | 'With relative' | 'Ambulance' | undefined
): HcReferralTransport | undefined {
  if (!s) return undefined;
  if (s === 'With relative') return 'With_relative';
  return s as HcReferralTransport;
}

export function apiSevereResultToPrisma(
  s: 'Positive' | 'Negative' | undefined
): SevereMalariaTestResult | undefined {
  return s;
}

export function apiFinalOutcomeToPrisma(
  s: 'Recovered' | 'Deceased' | undefined
): FinalOutcomeHospital | undefined {
  return s;
}

export function buildCreateCaseData(
  input: CreateCaseInput,
  opts: {
    caseRef: string;
    reporterUserId: string;
    reporterRole: UserRole;
    reporterDistrict: string;
    chwName: string;
    chwStaffCode: string | null;
  }
) {
  const dob = parseDateFlexible(
    typeof input.dateOfBirth === 'string' ? input.dateOfBirth : String(input.dateOfBirth)
  );
  const dfs = parseDateFlexible(
    typeof input.dateFirstSymptom === 'string'
      ? input.dateFirstSymptom
      : String(input.dateFirstSymptom)
  );
  const ageMs = Date.now() - dob.getTime();
  const age = Math.max(0, Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000)));
  const ageGroup: string = age < 5 ? 'Under 5' : '5 and above';
  const pid = input.patientId ?? input.patientCode;
  const chwTransfer = input.chwTransferDateTime
    ? parseDateFlexible(input.chwTransferDateTime)
    : new Date();
  const hasSevereSymptoms = input.symptoms.length > 0;
  const isFirstLineReporter =
    opts.reporterRole === 'HEALTH_CENTER' || opts.reporterRole === 'LOCAL_CLINIC';
  const chwPrimaryReferral: ChwPrimaryReferral =
    opts.reporterRole === 'LOCAL_CLINIC'
      ? 'LOCAL_CLINIC'
      : opts.reporterRole === 'CHW'
        ? input.chwPrimaryReferral === 'LOCAL_CLINIC'
          ? 'LOCAL_CLINIC'
          : 'HEALTH_CENTER'
        : 'HEALTH_CENTER';
  // CHW non-severe cases close at source. HC/LC walk-in registration must stay HC_Received for triage.
  const resolvedAtSource = !hasSevereSymptoms && !isFirstLineReporter;
  const status: CaseStatus =
    resolvedAtSource ? 'Resolved' : isFirstLineReporter ? 'HC_Received' : 'Pending';
  const receivedAt = input.hcPatientReceivedDateTime
    ? parseDateFlexible(input.hcPatientReceivedDateTime)
    : isFirstLineReporter && hasSevereSymptoms
      ? new Date()
      : null;

  return {
    caseRef: opts.caseRef,
    patientName: input.patientName,
    patientCode: input.patientCode,
    patientId: pid,
    sex: input.sex,
    dateOfBirth: dob,
    age,
    ageGroup,
    pregnant: input.pregnant,
    breastfeeding: input.breastfeeding,
    province:
      input.province?.trim() ||
      provinceFromDistrict(
        isFirstLineReporter ? opts.reporterDistrict : input.district
      ),
    district: isFirstLineReporter ? opts.reporterDistrict : input.district,
    sector: input.sector,
    cell: input.cell,
    village: input.village,
    gpsCoordinates: input.gpsCoordinates,
    maritalStatus: input.maritalStatus,
    familySize: input.familySize,
    educationLevel: input.educationLevel,
    occupation: input.occupation,
    economicStatus: input.economicStatus,
    distanceToHC: input.distanceToHC,
    transportMode: input.transportMode,
    hasInsurance: input.hasInsurance,
    insuranceType: input.insuranceType,
    nightOutings: input.nightOutings,
    nightOutingHours: input.nightOutingHours,
    dateFirstSymptom: dfs,
    timeToSeekCare: input.timeToSeekCare,
    usedTraditionalMedicine: input.usedTraditionalMedicine,
    consultedCHW: input.consultedCHW,
    consultedCHWDate: input.consultedCHWDate
      ? parseDateFlexible(input.consultedCHWDate)
      : undefined,
    rdtsAvailable: input.rdtsAvailable,
    chwRapidTestResult: input.chwRapidTestResult,
    chwSymptoms: input.symptoms,
    consultedHealthPost: input.consultedHealthPost,
    consultedHealthCenter: input.consultedHealthCenter,
    consultedHospital: input.consultedHospital,
    testType: input.testType,
    symptoms: input.symptoms,
    symptomCount: input.symptoms.length,
    houseWallStatus: input.houseWallStatus,
    mosquitoEntry: input.mosquitoEntry,
    breedingSites: input.breedingSites,
    preventionMeasures: input.preventionMeasures,
    llinAge: input.llinAge,
    llinSource: input.llinSource,
    llinStatus: input.llinStatus,
    sleepsUnderLLIN: input.sleepsUnderLLIN ?? false,
    // Non-severe/no-referral CHW cases are closed at source.
    status,
    chwName: opts.chwName,
    chwId: opts.chwStaffCode ?? opts.reporterUserId.slice(0, 8),
    healthCenter: isFirstLineReporter ? opts.chwName : input.healthCenter,
    chwPrimaryReferral,
    hospital: input.hospital,
    vulnerabilities: [] as string[],
    hcPatientReceivedDateTime: receivedAt,
    hcPreTreatment: input.hcPreTreatment ?? [],
    reportedToEIDSR: false,
    phaseRetourEligible: false,
    chwTransferDateTime: chwTransfer,
    chwReferralTransport: apiChwTransportToPrisma(input.chwReferralTransport) ?? 'Self',
    reportedByUserId: opts.reporterUserId,
  };
}

export function buildPatchCaseData(input: PatchCaseInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.status !== undefined) out.status = prismaCaseStatusFromApiString(input.status);
  if (input.testType !== undefined) out.testType = input.testType;
  if (input.plasmodiumSpecies !== undefined)
    out.plasmodiumSpecies = apiPlasmodiumToPrisma(input.plasmodiumSpecies);
  if (input.confirmedDate !== undefined)
    out.confirmedDate = input.confirmedDate ? parseDateFlexible(input.confirmedDate) : null;
  if (input.caseCategory !== undefined)
    out.caseCategory = apiCaseCategoryToPrisma(input.caseCategory);
  if (input.vulnerabilities !== undefined) out.vulnerabilities = input.vulnerabilities;
  if (input.hospitalChecklist !== undefined)
    out.hospitalChecklist = input.hospitalChecklist;
  if (input.outcome !== undefined) out.outcome = apiHospitalOutcomeToPrisma(input.outcome);
  if (input.outcomeDate !== undefined)
    out.outcomeDate = input.outcomeDate ? parseDateFlexible(input.outcomeDate) : null;
  if (input.outcomeNotes !== undefined) out.outcomeNotes = input.outcomeNotes;
  if (input.reportedToEIDSR !== undefined) out.reportedToEIDSR = input.reportedToEIDSR;
  if (input.hcPatientReceivedDateTime !== undefined)
    out.hcPatientReceivedDateTime = input.hcPatientReceivedDateTime
      ? parseDateFlexible(input.hcPatientReceivedDateTime)
      : null;
  if (input.hcPatientTransferredToHospitalDateTime !== undefined)
    out.hcPatientTransferredToHospitalDateTime =
      input.hcPatientTransferredToHospitalDateTime
        ? parseDateFlexible(input.hcPatientTransferredToHospitalDateTime)
        : null;
  if (input.hcReferralToHospitalTransport !== undefined)
    out.hcReferralToHospitalTransport = apiHcTransportToPrisma(
      input.hcReferralToHospitalTransport
    );
  if (input.hcPreTreatment !== undefined) out.hcPreTreatment = input.hcPreTreatment;
  if (input.symptoms !== undefined) {
    out.symptoms = input.symptoms;
    out.symptomCount = input.symptoms.length;
  }
  if (input.hospitalReceivedDateTime !== undefined)
    out.hospitalReceivedDateTime = input.hospitalReceivedDateTime
      ? parseDateFlexible(input.hospitalReceivedDateTime)
      : null;
  if (input.hospitalDischargeDateTime !== undefined)
    out.hospitalDischargeDateTime = input.hospitalDischargeDateTime
      ? parseDateFlexible(input.hospitalDischargeDateTime)
      : null;
  if (input.severeMalariaTestResult !== undefined)
    out.severeMalariaTestResult = apiSevereResultToPrisma(input.severeMalariaTestResult);
  if (input.hospitalManagementMedication !== undefined)
    out.hospitalManagementMedication = input.hospitalManagementMedication;
  if (input.finalOutcomeHospital !== undefined)
    out.finalOutcomeHospital = apiFinalOutcomeToPrisma(input.finalOutcomeHospital);
  if (input.phaseRetourEligible !== undefined)
    out.phaseRetourEligible = input.phaseRetourEligible;
  if (input.healthCenter !== undefined) out.healthCenter = input.healthCenter;
  if (input.hospital !== undefined) out.hospital = input.hospital;
  if (input.transferredToReferralHospital !== undefined)
    out.transferredToReferralHospital = input.transferredToReferralHospital;
  if (input.dhTransferredToReferralHospitalDateTime !== undefined) {
    out.dhTransferredToReferralHospitalDateTime =
      input.dhTransferredToReferralHospitalDateTime
        ? parseDateFlexible(input.dhTransferredToReferralHospitalDateTime)
        : null;
    if (input.dhTransferredToReferralHospitalDateTime) {
      out.transferredToReferralHospital = true;
    }
  }
  if (input.dhReferralToReferralHospitalTransport !== undefined)
    out.dhReferralToReferralHospitalTransport = apiHcTransportToPrisma(
      input.dhReferralToReferralHospitalTransport
    );
  if (input.referralHospitalReceivedDateTime !== undefined)
    out.referralHospitalReceivedDateTime =
      input.referralHospitalReceivedDateTime
        ? parseDateFlexible(input.referralHospitalReceivedDateTime)
        : null;
  if (input.dhHcPreTransferReceived !== undefined)
    out.dhHcPreTransferReceived = input.dhHcPreTransferReceived;
  if (input.dhObservationPlannedDays !== undefined)
    out.dhObservationPlannedDays = input.dhObservationPlannedDays;
  if (input.dhObservationStartedAt !== undefined)
    out.dhObservationStartedAt = input.dhObservationStartedAt
      ? parseDateFlexible(input.dhObservationStartedAt)
      : null;
  if (input.dhOralTreatmentReadyAt !== undefined)
    out.dhOralTreatmentReadyAt = input.dhOralTreatmentReadyAt
      ? parseDateFlexible(input.dhOralTreatmentReadyAt)
      : null;
  if (input.referralContinuityAcknowledgedAt !== undefined)
    out.referralContinuityAcknowledgedAt =
      input.referralContinuityAcknowledgedAt
        ? parseDateFlexible(input.referralContinuityAcknowledgedAt)
        : null;
  if (input.referralSymptomsUpdate !== undefined)
    out.referralSymptomsUpdate = input.referralSymptomsUpdate;
  if (input.referralClinicalTrend !== undefined)
    out.referralClinicalTrend = input.referralClinicalTrend;
  if (input.referralSpecializedCareUnit !== undefined)
    out.referralSpecializedCareUnit = input.referralSpecializedCareUnit;
  if (input.referralSpecializedCareAt !== undefined)
    out.referralSpecializedCareAt = input.referralSpecializedCareAt
      ? parseDateFlexible(input.referralSpecializedCareAt)
      : null;
  if (input.referralInpatientNotes !== undefined)
    out.referralInpatientNotes = input.referralInpatientNotes;
  if (input.transportMode !== undefined) out.transportMode = input.transportMode;
  return out;
}
