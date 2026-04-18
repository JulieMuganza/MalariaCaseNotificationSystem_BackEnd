-- Map legacy HC/DH transport values to new labels (separate migration: new enum labels must be committed first).
UPDATE "malaria_cases" SET "hcReferralToHospitalTransport" = 'Walk' WHERE "hcReferralToHospitalTransport" = 'Self';
UPDATE "malaria_cases" SET "hcReferralToHospitalTransport" = 'Motor' WHERE "hcReferralToHospitalTransport" = 'With_relative';
UPDATE "malaria_cases" SET "hcReferralToHospitalTransport" = 'Motor' WHERE "hcReferralToHospitalTransport" = 'Ambulance';

UPDATE "malaria_cases" SET "dhReferralToReferralHospitalTransport" = 'Walk' WHERE "dhReferralToReferralHospitalTransport" = 'Self';
UPDATE "malaria_cases" SET "dhReferralToReferralHospitalTransport" = 'Motor' WHERE "dhReferralToReferralHospitalTransport" = 'With_relative';
UPDATE "malaria_cases" SET "dhReferralToReferralHospitalTransport" = 'Motor' WHERE "dhReferralToReferralHospitalTransport" = 'Ambulance';
