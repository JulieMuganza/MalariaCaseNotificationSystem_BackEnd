-- Map legacy Self → Walk after enum labels exist (separate migration so new values are committed).
UPDATE "malaria_cases" SET "chwReferralTransport" = 'Walk' WHERE "chwReferralTransport" = 'Self';
