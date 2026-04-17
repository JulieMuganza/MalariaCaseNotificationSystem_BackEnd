-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CHW', 'HEALTH_CENTER', 'HOSPITAL', 'ADMIN', 'RICH');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('Pending', 'Referred', 'HC_Received', 'Escalated', 'Admitted', 'Treated', 'Discharged', 'Deceased', 'Resolved');

-- CreateEnum
CREATE TYPE "PlasmodiumSpecies" AS ENUM ('Falciparum', 'Malariae', 'Ovale', 'Vivax', 'Knowlesi', 'Not_specified');

-- CreateEnum
CREATE TYPE "CaseCategory" AS ENUM ('Index_case', 'Follow_up_case');

-- CreateEnum
CREATE TYPE "HospitalOutcome" AS ENUM ('Treated_Discharged', 'Still_Admitted', 'Referred_further', 'Deceased');

-- CreateEnum
CREATE TYPE "FinalOutcomeHospital" AS ENUM ('Recovered', 'Deceased');

-- CreateEnum
CREATE TYPE "ChwReferralTransport" AS ENUM ('Self', 'With_CHW', 'Ambulance');

-- CreateEnum
CREATE TYPE "HcReferralTransport" AS ENUM ('Self', 'With_relative', 'Ambulance');

-- CreateEnum
CREATE TYPE "SevereMalariaTestResult" AS ENUM ('Positive', 'Negative');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('alert', 'warning', 'info', 'success');

-- CreateEnum
CREATE TYPE "NotificationPhase" AS ENUM ('aller', 'retour');

-- CreateEnum
CREATE TYPE "ContentLevel" AS ENUM ('full', 'partial');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "district" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "staffCode" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "googleId" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_timeline_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malaria_cases" (
    "id" TEXT NOT NULL,
    "caseRef" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "age" INTEGER NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "pregnant" BOOLEAN,
    "breastfeeding" BOOLEAN,
    "district" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "cell" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "gpsCoordinates" TEXT,
    "maritalStatus" TEXT NOT NULL,
    "familySize" INTEGER NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "economicStatus" TEXT NOT NULL,
    "distanceToHC" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "hasInsurance" BOOLEAN NOT NULL,
    "insuranceType" TEXT,
    "nightOutings" BOOLEAN NOT NULL,
    "nightOutingHours" TEXT,
    "dateFirstSymptom" TIMESTAMP(3) NOT NULL,
    "timeToSeekCare" TEXT NOT NULL,
    "usedTraditionalMedicine" BOOLEAN NOT NULL,
    "consultedCHW" BOOLEAN NOT NULL,
    "consultedCHWDate" TIMESTAMP(3),
    "rdtsAvailable" BOOLEAN NOT NULL,
    "consultedHealthPost" BOOLEAN NOT NULL,
    "consultedHealthCenter" BOOLEAN NOT NULL,
    "consultedHospital" BOOLEAN NOT NULL,
    "symptoms" TEXT[],
    "symptomCount" INTEGER NOT NULL,
    "houseWallStatus" TEXT NOT NULL,
    "mosquitoEntry" BOOLEAN NOT NULL,
    "breedingSites" TEXT[],
    "preventionMeasures" TEXT[],
    "llinAge" TEXT,
    "llinSource" TEXT,
    "llinStatus" TEXT,
    "sleepsUnderLLIN" BOOLEAN,
    "status" "CaseStatus" NOT NULL,
    "chwName" TEXT NOT NULL,
    "chwId" TEXT NOT NULL,
    "healthCenter" TEXT,
    "hospital" TEXT,
    "testType" TEXT,
    "plasmodiumSpecies" "PlasmodiumSpecies",
    "confirmedDate" TIMESTAMP(3),
    "caseCategory" "CaseCategory",
    "vulnerabilities" TEXT[],
    "hospitalChecklist" JSONB,
    "outcome" "HospitalOutcome",
    "outcomeDate" TIMESTAMP(3),
    "outcomeNotes" TEXT,
    "reportedToEIDSR" BOOLEAN NOT NULL DEFAULT false,
    "chwTransferDateTime" TIMESTAMP(3),
    "chwReferralTransport" "ChwReferralTransport",
    "hcPatientReceivedDateTime" TIMESTAMP(3),
    "hcPatientTransferredToHospitalDateTime" TIMESTAMP(3),
    "hcReferralToHospitalTransport" "HcReferralTransport",
    "hcPreTreatment" TEXT[],
    "hospitalReceivedDateTime" TIMESTAMP(3),
    "hospitalDischargeDateTime" TIMESTAMP(3),
    "severeMalariaTestResult" "SevereMalariaTestResult",
    "hospitalManagementMedication" TEXT,
    "finalOutcomeHospital" "FinalOutcomeHospital",
    "phaseRetourEligible" BOOLEAN NOT NULL DEFAULT false,
    "reportedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "malaria_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "caseRef" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" "UserRole" NOT NULL,
    "phase" "NotificationPhase",
    "contentLevel" "ContentLevel",
    "recipientRoles" TEXT,
    "userId" TEXT,
    "malariaCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_role_district_idx" ON "users"("role", "district");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "case_timeline_entries_caseId_createdAt_idx" ON "case_timeline_entries"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "malaria_cases_caseRef_key" ON "malaria_cases"("caseRef");

-- CreateIndex
CREATE INDEX "malaria_cases_district_status_idx" ON "malaria_cases"("district", "status");

-- CreateIndex
CREATE INDEX "malaria_cases_status_idx" ON "malaria_cases"("status");

-- CreateIndex
CREATE INDEX "malaria_cases_createdAt_idx" ON "malaria_cases"("createdAt");

-- CreateIndex
CREATE INDEX "malaria_cases_reportedByUserId_idx" ON "malaria_cases"("reportedByUserId");

-- CreateIndex
CREATE INDEX "notifications_targetRole_read_idx" ON "notifications"("targetRole", "read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_malariaCaseId_idx" ON "notifications"("malariaCaseId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_timeline_entries" ADD CONSTRAINT "case_timeline_entries_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "malaria_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malaria_cases" ADD CONSTRAINT "malaria_cases_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_malariaCaseId_fkey" FOREIGN KEY ("malariaCaseId") REFERENCES "malaria_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
