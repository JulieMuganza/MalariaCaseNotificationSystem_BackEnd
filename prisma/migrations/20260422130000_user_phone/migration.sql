-- Add optional phone number for user registration/profile updates
ALTER TABLE "users"
ADD COLUMN "phone" TEXT;
