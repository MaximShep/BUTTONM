ALTER TABLE "Project" ADD COLUMN "currentStep" TEXT NOT NULL DEFAULT 'questions';

UPDATE "Project"
SET "currentStep" = CASE
  WHEN "status" = 'scripts_generated' THEN 'scripts'
  WHEN "status" = 'generating_scripts' THEN 'generation'
  WHEN "status" = 'questions_approved' THEN 'generation'
  ELSE 'questions'
END;
