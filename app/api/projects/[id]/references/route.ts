import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { referenceVideoPath } from "@/lib/references/paths";
import { detectReferenceType, isProjectReferenceType } from "@/lib/references/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "_").slice(0, 140);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id } = await context.params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id }, select: { id: true } });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден или недоступен." }, { status: 404 });
  }

  const formData = await request.formData();
  const requestedType = String(formData.get("type") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const detectedType = url ? detectReferenceType(url) : requestedType;
  const type = detectedType !== "unknown" && detectedType !== "manual" ? detectedType : requestedType;
  const transcriptText = String(formData.get("transcriptText") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("file");

  if (!isProjectReferenceType(type)) {
    return NextResponse.json({ error: "Выберите поддерживаемый тип референса." }, { status: 400 });
  }

  if (!url && !transcriptText && !notes && !(file instanceof File && file.size > 0)) {
    return NextResponse.json({ error: "Добавьте ссылку, видео, расшифровку или заметку к референсу." }, { status: 400 });
  }

  const reference = await prisma.projectReference.create({
    data: {
      projectId: project.id,
      type,
      url: url || null,
      transcriptText: transcriptText || null,
      notes: notes || null,
      useInGeneration: true,
      status: "added",
    },
  });

  if (file instanceof File && file.size > 0) {
    const outputPath = referenceVideoPath(project.id, reference.id);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(await file.arrayBuffer()));
    await prisma.projectReference.update({
      where: { id: reference.id },
      data: {
        fileName: safeFileName(file.name),
        localFilePath: outputPath,
      },
    });
  }

  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      type: "reference.added",
      payloadJson: JSON.stringify({ referenceId: reference.id, type }),
    },
  });

  return NextResponse.json({ referenceId: reference.id });
}
