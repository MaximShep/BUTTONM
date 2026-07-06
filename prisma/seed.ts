import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import { PDFParse } from "pdf-parse";
import { getSourceMaterialPath } from "../lib/files/source-materials-data";

const prisma = new PrismaClient();

const baseStyleRules = [
  "Не использовать прямые рекламные фразы и канцелярские формулировки.",
  "Финальные титры делать короткими, живыми и слегка ироничными.",
  "Чаще использовать POV, бытовые ситуации и конкретное действие в кадре.",
  "Интегрировать продукт через проблему, наблюдение или привычку, а не через сухой список преимуществ.",
];

async function extractSeedPdfText(file: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(file) });

  try {
    const result = await parser.getText();
    const text = result.text.trim();

    if (!text) {
      throw new Error("PDF does not contain extractable text.");
    }

    return text;
  } finally {
    await parser.destroy();
  }
}

async function seedReferenceExample(userId: string) {
  try {
    const file = await readFile(getSourceMaterialPath("referenceScripts"));
    const scriptsText = await extractSeedPdfText(file);
    const title = "Локальный эталон сценариев";

    const existing = await prisma.styleExample.findFirst({
      where: { userId, title },
      select: { id: true },
    });

    if (existing) {
      await prisma.styleExample.update({
        where: { id: existing.id },
        data: {
          scriptsText,
          finalScriptsText: scriptsText,
          briefText: "",
          comment: "Локальный пример финальных сценариев из исходных материалов.",
          active: true,
        },
      });
      return;
    }

    await prisma.styleExample.create({
      data: {
        userId,
        title,
        briefText: "",
        scriptsText,
        finalScriptsText: scriptsText,
        comment: "Локальный пример финальных сценариев из исходных материалов.",
        active: true,
      },
    });
  } catch (error) {
    console.warn(
      `Reference style example was not seeded: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main() {
  const login = process.env.SEED_LOGIN ?? "blogger";
  const password = process.env.SEED_PASSWORD ?? "password123";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { login },
    update: { passwordHash },
    create: { login, passwordHash },
  });

  for (const rule of baseStyleRules) {
    const existing = await prisma.styleRule.findFirst({
      where: { userId: user.id, rule },
      select: { id: true },
    });

    if (!existing) {
      await prisma.styleRule.create({
        data: {
          userId: user.id,
          rule,
          source: "seed",
        },
      });
    }
  }

  await seedReferenceExample(user.id);

  console.log(`Seed user is ready: ${login}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
