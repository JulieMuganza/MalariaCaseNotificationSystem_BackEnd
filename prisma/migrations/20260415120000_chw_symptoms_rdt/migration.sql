-- CHW snapshot symptoms + rapid test result for HC display and reporting
ALTER TABLE "malaria_cases" ADD COLUMN "chwSymptoms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "malaria_cases" ADD COLUMN "chwRapidTestResult" TEXT;

-- Backfill snapshot from current symptoms for existing rows
UPDATE "malaria_cases" SET "chwSymptoms" = "symptoms" WHERE COALESCE(array_length("chwSymptoms", 1), 0) = 0 AND COALESCE(array_length("symptoms", 1), 0) > 0;
