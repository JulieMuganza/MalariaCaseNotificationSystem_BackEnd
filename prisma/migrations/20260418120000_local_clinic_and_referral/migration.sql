-- ChwPrimaryReferral: where CHW sends a severe case first (health center vs local clinic).
CREATE TYPE "ChwPrimaryReferral" AS ENUM ('HEALTH_CENTER', 'LOCAL_CLINIC');

ALTER TABLE "malaria_cases" ADD COLUMN "chwPrimaryReferral" "ChwPrimaryReferral" NOT NULL DEFAULT 'HEALTH_CENTER';

ALTER TYPE "UserRole" ADD VALUE 'LOCAL_CLINIC';
