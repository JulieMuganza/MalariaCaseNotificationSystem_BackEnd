-- AlterEnum (safe to run once per database)
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'REFERRAL_HOSPITAL';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "malaria_cases" ADD COLUMN "transferredToReferralHospital" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "malaria_cases" ADD COLUMN "dhTransferredToReferralHospitalDateTime" TIMESTAMP(3);
ALTER TABLE "malaria_cases" ADD COLUMN "referralHospitalReceivedDateTime" TIMESTAMP(3);
