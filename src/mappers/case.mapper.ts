import type {
  Case,
  CaseTimelineEntry,
  CaseStatus,
  PlasmodiumSpecies,
  CaseCategory,
  HospitalOutcome,
  FinalOutcomeHospital,
  ChwReferralTransport,
  HcReferralTransport,
  SevereMalariaTestResult,
  UserRole,
} from '@prisma/client';

export type CaseApi = Record<string, unknown>;

/** Prisma → API status string (matches case list payloads). */
export function mapCaseStatusToApi(s: CaseStatus): string {
  if (s === 'HC_Received') return 'HC Received';
  return s;
}

function mapPlasmodium(p: PlasmodiumSpecies | null | undefined): string | undefined {
  if (!p) return undefined;
  if (p === 'Not_specified') return 'Not specified';
  return p;
}

function mapCaseCategory(c: CaseCategory | null | undefined):
  | 'Index case'
  | 'Follow-up case'
  | undefined {
  if (!c) return undefined;
  if (c === 'Index_case') return 'Index case';
  return 'Follow-up case';
}

function mapOutcome(o: HospitalOutcome | null | undefined): string | undefined {
  if (!o) return undefined;
  const m: Record<HospitalOutcome, string> = {
    Treated_Discharged: 'Treated & Discharged',
    Still_Admitted: 'Still Admitted',
    Referred_further: 'Referred further',
    Deceased: 'Deceased',
  };
  return m[o];
}

function mapFinalOutcome(
  o: FinalOutcomeHospital | null | undefined
): 'Recovered' | 'Deceased' | undefined {
  return o ?? undefined;
}

function mapChwTransport(
  t: ChwReferralTransport | null | undefined
): 'Self' | 'With CHW' | 'Ambulance' | undefined {
  if (!t) return undefined;
  if (t === 'With_CHW') return 'With CHW';
  return t as 'Self' | 'Ambulance';
}

function mapHcTransport(
  t: HcReferralTransport | null | undefined
): 'Self' | 'With relative' | 'Ambulance' | undefined {
  if (!t) return undefined;
  if (t === 'With_relative') return 'With relative';
  return t as 'Self' | 'Ambulance';
}

function mapSevereResult(
  r: SevereMalariaTestResult | null | undefined
): 'Positive' | 'Negative' | undefined {
  return r ?? undefined;
}

export function mapTimelineEntry(e: CaseTimelineEntry) {
  return {
    event: e.event,
    timestamp: e.createdAt.toISOString(),
    actor: e.actorName,
    role: e.actorRole,
  };
}

/** Strip hospital-only clinical fields for HC/CHW API responses (management stays in Hospital & surveillance partners). */
export function mapCaseToApiForViewer(
  c: Case & { timeline: CaseTimelineEntry[] },
  role: UserRole
): CaseApi {
  const full = mapCaseToApi(c) as CaseApi;
  if (
    role === 'ADMIN' ||
    role === 'RICH' ||
    role === 'PFTH' ||
    role === 'SFR' ||
    role === 'HOSPITAL' ||
    role === 'REFERRAL_HOSPITAL'
  ) {
    return full;
  }
  delete full.hospitalManagementMedication;
  delete full.hospitalChecklist;
  return full;
}

export function mapCaseToApi(c: Case & { timeline: CaseTimelineEntry[] }): CaseApi {
  const checklist = c.hospitalChecklist as Record<string, string> | null;
  return {
    id: c.caseRef,
    province: c.province,
    patientName: c.patientName,
    patientCode: c.patientCode,
    patientId: c.patientId,
    sex: c.sex,
    dateOfBirth: c.dateOfBirth.toISOString(),
    age: c.age,
    ageGroup: c.ageGroup as 'Under 5' | '5 and above',
    pregnant: c.pregnant ?? undefined,
    breastfeeding: c.breastfeeding ?? undefined,
    district: c.district,
    sector: c.sector,
    cell: c.cell,
    village: c.village,
    gpsCoordinates: c.gpsCoordinates ?? undefined,
    maritalStatus: c.maritalStatus,
    familySize: c.familySize,
    educationLevel: c.educationLevel,
    occupation: c.occupation,
    economicStatus: c.economicStatus,
    distanceToHC: c.distanceToHC,
    transportMode: c.transportMode,
    hasInsurance: c.hasInsurance,
    insuranceType: c.insuranceType ?? undefined,
    nightOutings: c.nightOutings,
    nightOutingHours: c.nightOutingHours ?? undefined,
    dateFirstSymptom: c.dateFirstSymptom.toISOString(),
    timeToSeekCare: c.timeToSeekCare,
    usedTraditionalMedicine: c.usedTraditionalMedicine,
    consultedCHW: c.consultedCHW,
    consultedCHWDate: c.consultedCHWDate?.toISOString(),
    rdtsAvailable: c.rdtsAvailable,
    consultedHealthPost: c.consultedHealthPost,
    consultedHealthCenter: c.consultedHealthCenter,
    consultedHospital: c.consultedHospital,
    symptoms: c.symptoms,
    symptomCount: c.symptomCount,
    chwSymptoms: c.chwSymptoms,
    chwRapidTestResult: c.chwRapidTestResult ?? undefined,
    houseWallStatus: c.houseWallStatus,
    mosquitoEntry: c.mosquitoEntry,
    breedingSites: c.breedingSites,
    preventionMeasures: c.preventionMeasures,
    llinAge: c.llinAge ?? undefined,
    llinSource: c.llinSource ?? undefined,
    llinStatus: c.llinStatus ?? undefined,
    sleepsUnderLLIN: c.sleepsUnderLLIN ?? undefined,
    status: mapCaseStatusToApi(c.status),
    chwName: c.chwName,
    chwId: c.chwId,
    chwPrimaryReferral: c.chwPrimaryReferral,
    healthCenter: c.healthCenter ?? undefined,
    hospital: c.hospital ?? undefined,
    testType: c.testType ?? undefined,
    plasmodiumSpecies: mapPlasmodium(c.plasmodiumSpecies) as
      | 'Falciparum'
      | 'Malariae'
      | 'Ovale'
      | 'Vivax'
      | 'Knowlesi'
      | 'Not specified'
      | undefined,
    confirmedDate: c.confirmedDate?.toISOString(),
    caseCategory: mapCaseCategory(c.caseCategory),
    vulnerabilities: c.vulnerabilities,
    hospitalChecklist: checklist ?? undefined,
    outcome: mapOutcome(c.outcome),
    outcomeDate: c.outcomeDate?.toISOString(),
    outcomeNotes: c.outcomeNotes ?? undefined,
    reportedToEIDSR: c.reportedToEIDSR,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    timeline: c.timeline.map(mapTimelineEntry),
    chwTransferDateTime: c.chwTransferDateTime?.toISOString(),
    chwReferralTransport: mapChwTransport(c.chwReferralTransport),
    hcPatientReceivedDateTime: c.hcPatientReceivedDateTime?.toISOString(),
    hcPatientTransferredToHospitalDateTime:
      c.hcPatientTransferredToHospitalDateTime?.toISOString(),
    hcReferralToHospitalTransport: mapHcTransport(c.hcReferralToHospitalTransport),
    hcPreTreatment: c.hcPreTreatment.length ? c.hcPreTreatment : undefined,
    hospitalReceivedDateTime: c.hospitalReceivedDateTime?.toISOString(),
    hospitalDischargeDateTime: c.hospitalDischargeDateTime?.toISOString(),
    severeMalariaTestResult: mapSevereResult(c.severeMalariaTestResult),
    hospitalManagementMedication: c.hospitalManagementMedication ?? undefined,
    finalOutcomeHospital: mapFinalOutcome(c.finalOutcomeHospital),
    phaseRetourEligible: c.phaseRetourEligible,
    transferredToReferralHospital: c.transferredToReferralHospital,
    dhTransferredToReferralHospitalDateTime:
      c.dhTransferredToReferralHospitalDateTime?.toISOString(),
    dhReferralToReferralHospitalTransport: mapHcTransport(
      c.dhReferralToReferralHospitalTransport
    ),
    referralHospitalReceivedDateTime:
      c.referralHospitalReceivedDateTime?.toISOString(),
    dhHcPreTransferReceived: c.dhHcPreTransferReceived ?? undefined,
    dhObservationPlannedDays: c.dhObservationPlannedDays ?? undefined,
    dhObservationStartedAt: c.dhObservationStartedAt?.toISOString(),
    dhOralTreatmentReadyAt: c.dhOralTreatmentReadyAt?.toISOString(),
    referralContinuityAcknowledgedAt:
      c.referralContinuityAcknowledgedAt?.toISOString(),
    referralSymptomsUpdate: c.referralSymptomsUpdate ?? undefined,
    referralClinicalTrend: c.referralClinicalTrend ?? undefined,
    referralSpecializedCareUnit: c.referralSpecializedCareUnit ?? undefined,
    referralSpecializedCareAt:
      c.referralSpecializedCareAt?.toISOString(),
    referralInpatientNotes: c.referralInpatientNotes ?? undefined,
  };
}
