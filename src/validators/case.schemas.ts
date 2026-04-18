import { z } from 'zod';

const caseStatusApi = z.enum([
  'Pending',
  'Referred',
  'HC Received',
  'Escalated',
  'Admitted',
  'Treated',
  'Discharged',
  'Deceased',
  'Resolved',
]);

/** CHW / shared create payload (matches frontend-friendly shapes) */
const createCaseSchemaBase = z.object({
  patientName: z.string().min(1),
  patientCode: z.string().min(1),
  patientId: z.string().optional(),
  sex: z.enum(['Male', 'Female']),
  dateOfBirth: z.string().min(4),
  province: z.string().min(1).optional(),
  district: z.string().min(1),
  sector: z.string().min(1),
  cell: z.string().min(1),
  village: z.string().min(1),
  gpsCoordinates: z.string().optional(),
  maritalStatus: z.string().min(1).default('Single'),
  familySize: z.coerce.number().int().min(1).default(1),
  educationLevel: z.string().default('Primary'),
  occupation: z.string().default('None'),
  economicStatus: z.string().default('Low'),
  distanceToHC: z.string().default('< 1hr'),
  transportMode: z.string().default('Walk'),
  hasInsurance: z.boolean().default(false),
  insuranceType: z.string().optional(),
  nightOutings: z.boolean().default(false),
  nightOutingHours: z.string().optional(),
  dateFirstSymptom: z.string().min(4),
  timeToSeekCare: z.string().default('In 24hrs'),
  usedTraditionalMedicine: z.boolean().default(false),
  consultedCHW: z.boolean().default(false),
  consultedCHWDate: z.string().optional(),
  rdtsAvailable: z.boolean().default(false),
  consultedHealthPost: z.boolean().default(false),
  consultedHealthCenter: z.boolean().default(false),
  consultedHospital: z.boolean().default(false),
  chwRapidTestResult: z.enum(['Positive', 'Negative']),
  testType: z.string().optional(),
  hcPreTreatment: z.array(z.string()).optional(),
  hcPatientReceivedDateTime: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  houseWallStatus: z.string().default('Trees+not cemented'),
  mosquitoEntry: z.boolean().default(false),
  breedingSites: z.array(z.string()).default([]),
  preventionMeasures: z.array(z.string()).default([]),
  llinAge: z.string().optional(),
  llinSource: z.string().optional(),
  llinStatus: z.string().optional(),
  sleepsUnderLLIN: z.boolean().optional(),
  pregnant: z.boolean().optional(),
  breastfeeding: z.boolean().optional(),
  chwTransferDateTime: z.string().min(4).optional(),
  chwReferralTransport: z
    .enum(['Walk', 'Motorcycle', 'Car', 'With CHW', 'Ambulance', 'Self'])
    .optional(),
  /** CHW: send severe referral to health center or local clinic first. */
  chwPrimaryReferral: z.enum(['HEALTH_CENTER', 'LOCAL_CLINIC']).optional(),
  healthCenter: z.string().optional(),
  hospital: z.string().optional(),
});

export const createCaseSchema = createCaseSchemaBase.superRefine((data, ctx) => {
  if (data.hasInsurance && !String(data.insuranceType ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select an insurance type when insurance is yes.',
      path: ['insuranceType'],
    });
  }
  if (data.chwRapidTestResult === 'Negative') {
    if (data.symptoms.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Symptoms must be empty when rapid test is negative.',
        path: ['symptoms'],
      });
    }
  } else if (data.chwRapidTestResult === 'Positive' && data.symptoms.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one severe symptom when rapid test is positive.',
      path: ['symptoms'],
    });
  }
});

export const patchCaseSchema = z
  .object({
    status: caseStatusApi.optional(),
    testType: z.string().optional(),
    plasmodiumSpecies: z
      .enum(['Falciparum', 'Malariae', 'Ovale', 'Vivax', 'Knowlesi', 'Not specified'])
      .optional(),
    confirmedDate: z.string().optional(),
    caseCategory: z.enum(['Index case', 'Follow-up case']).optional(),
    vulnerabilities: z.array(z.string()).optional(),
    hospitalChecklist: z.record(z.enum(['Compliant', 'Non-compliant', 'N/A'])).optional(),
    outcome: z
      .enum(['Treated & Discharged', 'Still Admitted', 'Referred further', 'Deceased'])
      .optional(),
    outcomeDate: z.string().optional(),
    outcomeNotes: z.string().optional(),
    reportedToEIDSR: z.boolean().optional(),
    hcPatientReceivedDateTime: z.string().optional(),
    hcPatientTransferredToHospitalDateTime: z.string().optional(),
    hcReferralToHospitalTransport: z
      .enum(['Self', 'With relative', 'Ambulance'])
      .optional(),
    hcPreTreatment: z.array(z.string()).optional(),
    /** HC may record additional clinical symptoms at facility (not sent in partial notifications). */
    symptoms: z.array(z.string()).optional(),
    hospitalReceivedDateTime: z.string().optional(),
    hospitalDischargeDateTime: z.string().optional(),
    severeMalariaTestResult: z.enum(['Positive', 'Negative']).optional(),
    hospitalManagementMedication: z.string().optional(),
    finalOutcomeHospital: z.enum(['Recovered', 'Deceased']).optional(),
    phaseRetourEligible: z.boolean().optional(),
    healthCenter: z.string().optional(),
    hospital: z.string().optional(),
    transferredToReferralHospital: z.boolean().optional(),
    dhTransferredToReferralHospitalDateTime: z.string().optional(),
    dhReferralToReferralHospitalTransport: z
      .enum(['Self', 'With relative', 'Ambulance'])
      .optional(),
    referralHospitalReceivedDateTime: z.string().optional(),
    dhHcPreTransferReceived: z.boolean().optional(),
    dhObservationPlannedDays: z.number().int().min(1).max(7).optional(),
    dhObservationStartedAt: z.string().optional(),
    dhOralTreatmentReadyAt: z.string().optional(),
    referralContinuityAcknowledgedAt: z.string().optional(),
    referralSymptomsUpdate: z.string().optional(),
    referralClinicalTrend: z
      .enum(['improving', 'stable', 'worsening'])
      .optional(),
    referralSpecializedCareUnit: z.string().optional(),
    referralSpecializedCareAt: z.string().optional(),
    referralInpatientNotes: z.string().optional(),
    timelineEvent: z
      .object({
        event: z.string().min(1),
        actorName: z.string().min(1),
        actorRole: z.string().min(1),
      })
      .optional(),
    /** How the patient arrived at the health center (recorded by HC). */
    transportMode: z.string().optional(),
  });

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type PatchCaseInput = z.infer<typeof patchCaseSchema>;
