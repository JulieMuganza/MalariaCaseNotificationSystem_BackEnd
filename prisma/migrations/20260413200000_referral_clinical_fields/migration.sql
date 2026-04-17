-- Referral hospital clinical follow-up (continuity, symptoms update, specialized care, notes).
ALTER TABLE "malaria_cases" ADD COLUMN "referralContinuityAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "malaria_cases" ADD COLUMN "referralSymptomsUpdate" TEXT;
ALTER TABLE "malaria_cases" ADD COLUMN "referralClinicalTrend" TEXT;
ALTER TABLE "malaria_cases" ADD COLUMN "referralSpecializedCareUnit" TEXT;
ALTER TABLE "malaria_cases" ADD COLUMN "referralSpecializedCareAt" TIMESTAMP(3);
ALTER TABLE "malaria_cases" ADD COLUMN "referralInpatientNotes" TEXT;
