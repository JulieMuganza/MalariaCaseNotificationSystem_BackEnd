-- HC → district hospital & DH → referral hospital transport options (Walk, Bicycle, Motor, Car/Bus).
-- Legacy labels (Self, With_relative, Ambulance) remain on the enum for existing rows until data migration.
ALTER TYPE "HcReferralTransport" ADD VALUE 'Walk';
ALTER TYPE "HcReferralTransport" ADD VALUE 'Bicycle';
ALTER TYPE "HcReferralTransport" ADD VALUE 'Motor';
ALTER TYPE "HcReferralTransport" ADD VALUE 'Car_Bus';
