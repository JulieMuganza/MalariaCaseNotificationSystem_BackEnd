-- District hospital severe malaria pathway (pre-transfer confirmation, observation window, oral step-down).
ALTER TABLE "malaria_cases" ADD COLUMN "dhHcPreTransferReceived" BOOLEAN;
ALTER TABLE "malaria_cases" ADD COLUMN "dhObservationPlannedDays" INTEGER;
ALTER TABLE "malaria_cases" ADD COLUMN "dhObservationStartedAt" TIMESTAMP(3);
ALTER TABLE "malaria_cases" ADD COLUMN "dhOralTreatmentReadyAt" TIMESTAMP(3);
