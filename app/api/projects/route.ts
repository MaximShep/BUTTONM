import { NextResponse, type NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { appUrl } from "@/lib/appUrl";
import { getCurrentUser } from "@/lib/auth";
import { extractPdfText } from "@/lib/files/extractPdfText";
import { prisma } from "@/lib/prisma";
import { analyzeBriefQuestionsAndReplace } from "@/lib/projects/briefQuestions";
import { referenceVideoPath } from "@/lib/references/paths";
import { detectReferenceType, isProjectReferenceType } from "@/lib/references/types";
import { generationErrorMessage } from "@/lib/userMessages";

export const runtime = "nodejs";

function boundedInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "_").slice(0, 140);
}

function parseReferenceIds(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeFileName(value: string | null | undefined) {
  return normalizeText(value).replace(/\.[^.]+$/, "");
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const pastedBriefText = String(formData.get("briefText") ?? "").trim();
  const generationComment = String(formData.get("generationComment") ?? "").trim();
  const briefFile = formData.get("briefFile");
  const scriptsCount = boundedInt(formData.get("scriptsCount"), 5, 1, 20);
  const referenceScriptsCount = boundedInt(formData.get("referenceScriptsCount"), 0, 0, scriptsCount);
  let briefText = pastedBriefText;
  let briefFileName: string | null = null;

  if (briefFile instanceof File && briefFile.size > 0) {
    if (briefFile.type && briefFile.type !== "application/pdf") {
      return NextResponse.redirect(appUrl("/projects/new?error=pdf_type", request.url), 303);
    }

    try {
      briefText = await extractPdfText(await briefFile.arrayBuffer());
      briefFileName = briefFile.name;
    } catch {
      return NextResponse.redirect(appUrl("/projects/new?error=pdf_read", request.url), 303);
    }
  }

  if (!title || !brand || !briefText) {
    return NextResponse.redirect(appUrl("/projects/new?error=required", request.url), 303);
  }

  const duplicateWindow = new Date(Date.now() - 15 * 60 * 1000);
  const recentProjects = await prisma.project.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: duplicateWindow },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      brand: true,
      briefText: true,
      briefFileName: true,
    },
  });
  const duplicateProject = recentProjects.find((item) => {
    const sameTitle = normalizeText(item.title) === normalizeText(title);
    const sameBrand = normalizeText(item.brand) === normalizeText(brand);
    const sameBrief = normalizeText(item.briefText) === normalizeText(briefText);
    const sameBriefFile = Boolean(
      briefFileName &&
        item.briefFileName &&
        normalizeFileName(item.briefFileName) === normalizeFileName(briefFileName),
    );

    return sameTitle && sameBrand && (sameBrief || sameBriefFile);
  });

  if (duplicateProject) {
    return NextResponse.redirect(appUrl(`/projects/${duplicateProject.id}`, request.url), 303);
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title,
      brand,
      briefText,
      briefFileName,
      generationComment: generationComment || null,
      scriptsCount,
      referenceScriptsCount,
      status: "questions_pending",
      currentStep: "questions",
      events: {
        create: {
          type: "project.created",
          payloadJson: JSON.stringify({ title, brand, briefFileName, referenceScriptsCount }),
        },
      },
    },
  });

  const referenceIds = parseReferenceIds(formData.get("referenceIds"));
  const referencesToCreate = [];

  for (const referenceId of referenceIds) {
    const type = String(formData.get(`referenceType-${referenceId}`) ?? "");
    if (!isProjectReferenceType(type)) continue;

    const url = String(formData.get(`referenceUrl-${referenceId}`) ?? "").trim();
    const detectedType = url ? detectReferenceType(url) : type;
    const referenceType = detectedType !== "unknown" && detectedType !== "manual" ? detectedType : type;
    const text = String(formData.get(`referenceText-${referenceId}`) ?? "").trim();
    const file = formData.get(`referenceFile-${referenceId}`);
    let fileName: string | null = null;
    let localFilePath: string | null = null;

    if (file instanceof File && file.size > 0) {
      fileName = safeFileName(file.name);
      localFilePath = referenceVideoPath(project.id, referenceId);
      await mkdir(path.dirname(localFilePath), { recursive: true });
      await writeFile(localFilePath, Buffer.from(await file.arrayBuffer()));
    }

    if (!url && !text && !localFilePath) continue;

    referencesToCreate.push({
      projectId: project.id,
      type: referenceType,
      url: url || null,
      fileName,
      localFilePath,
      transcriptText: referenceType === "manual" ? text || null : null,
      notes: referenceType === "manual" ? null : text || null,
      useInGeneration: true,
      status: "added",
    });
  }

  if (referencesToCreate.length) {
    await prisma.projectReference.createMany({ data: referencesToCreate });
    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type: "references.added",
        payloadJson: JSON.stringify({ referencesCount: referencesToCreate.length }),
      },
    });
  }

  try {
    await analyzeBriefQuestionsAndReplace(project.id, project.briefText);
  } catch (error) {
    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type: "brief.questions_analysis_failed",
        payloadJson: JSON.stringify({
          error: generationErrorMessage(error),
        }),
      },
    });
  }

  return NextResponse.redirect(appUrl(`/projects/${project.id}`, request.url), 303);
}
