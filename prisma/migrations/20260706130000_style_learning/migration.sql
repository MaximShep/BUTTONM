-- CreateTable
CREATE TABLE "StyleLearning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "badPatternsJson" TEXT NOT NULL,
    "goodPatternsJson" TEXT NOT NULL,
    "phrasesToAvoidJson" TEXT NOT NULL,
    "phrasesToPreferJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StyleLearning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StyleLearning_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StyleLearning_userId_idx" ON "StyleLearning"("userId");

-- CreateIndex
CREATE INDEX "StyleLearning_scriptId_idx" ON "StyleLearning"("scriptId");
