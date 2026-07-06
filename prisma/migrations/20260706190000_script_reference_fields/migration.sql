ALTER TABLE "Script" ADD COLUMN "basedOnReference" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Script" ADD COLUMN "referenceReason" TEXT;
