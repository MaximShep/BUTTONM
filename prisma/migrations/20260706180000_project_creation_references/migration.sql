ALTER TABLE "Project" ADD COLUMN "generationComment" TEXT;
ALTER TABLE "Project" ADD COLUMN "referenceScriptsCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ProjectReference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT,
  "fileName" TEXT,
  "localFilePath" TEXT,
  "transcriptText" TEXT,
  "extractedScenarioText" TEXT,
  "notes" TEXT,
  "useInGeneration" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'added',
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProjectReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectReference_projectId_idx" ON "ProjectReference"("projectId");
