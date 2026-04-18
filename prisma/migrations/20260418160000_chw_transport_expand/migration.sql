-- Expand CHW referral transport (walk / moto / car align with HC "how patient came").
-- Do not UPDATE to new enum values in this migration: Postgres requires enum additions
-- to be committed before those labels can be used (see 55P04). Map Self→Walk in the next migration.
ALTER TYPE "ChwReferralTransport" ADD VALUE 'Walk';
ALTER TYPE "ChwReferralTransport" ADD VALUE 'Motorcycle';
ALTER TYPE "ChwReferralTransport" ADD VALUE 'Car';
