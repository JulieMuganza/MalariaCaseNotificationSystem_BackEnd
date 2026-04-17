-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationOtpHash" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
