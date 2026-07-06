import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CLOSE_CREATED_AT_MS = 15 * 60 * 1000;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFileName(value: string | null | undefined) {
  return normalizeText(value).replace(/\.[^.]+$/, "");
}

function isCloseDate(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= CLOSE_CREATED_AT_MS;
}

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      userId: true,
      title: true,
      brand: true,
      briefFileName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { scripts: true, questions: true } },
    },
  });

  const duplicates: Array<typeof projects> = [];

  for (const project of projects) {
    const duplicateGroup = projects.filter((candidate) => {
      if (candidate.id === project.id || candidate.userId !== project.userId) return false;

      const sameTitle = normalizeText(candidate.title) === normalizeText(project.title);
      const sameBriefFile =
        normalizeFileName(candidate.briefFileName) &&
        normalizeFileName(candidate.briefFileName) === normalizeFileName(project.briefFileName);

      return (sameTitle || sameBriefFile) && isCloseDate(candidate.createdAt, project.createdAt);
    });

    if (duplicateGroup.length > 0) {
      const ids = new Set([project.id, ...duplicateGroup.map((item) => item.id)]);
      const group = projects.filter((item) => ids.has(item.id));

      if (!duplicates.some((existing) => existing.every((item) => ids.has(item.id)))) {
        duplicates.push(group);
      }
    }
  }

  if (!duplicates.length) {
    console.log("Possible duplicate projects were not found.");
    return;
  }

  console.log(`Possible duplicate groups: ${duplicates.length}`);
  console.log("No records were changed or deleted.");

  duplicates.forEach((group, index) => {
    console.log(`\nGroup ${index + 1}`);

    for (const project of group) {
      console.log(
        [
          `id=${project.id}`,
          `userId=${project.userId}`,
          `title="${project.title}"`,
          `brand="${project.brand}"`,
          `briefFile="${project.briefFileName ?? ""}"`,
          `status=${project.status}`,
          `scripts=${project._count.scripts}`,
          `questions=${project._count.questions}`,
          `createdAt=${project.createdAt.toISOString()}`,
          `updatedAt=${project.updatedAt.toISOString()}`,
        ].join(" | "),
      );
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
