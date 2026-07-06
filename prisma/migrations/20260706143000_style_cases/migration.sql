ALTER TABLE "StyleExample" ADD COLUMN "briefFileName" TEXT;
ALTER TABLE "StyleExample" ADD COLUMN "finalScriptsText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StyleExample" ADD COLUMN "scriptsFileName" TEXT;
ALTER TABLE "StyleExample" ADD COLUMN "comment" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StyleExample" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StyleExample" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

UPDATE "StyleExample"
SET
  "finalScriptsText" = "scriptsText",
  "updatedAt" = "createdAt"
WHERE "finalScriptsText" = '';
