import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProjectScripts } from "@/lib/projects/scripts";
import { generationErrorMessage } from "@/lib/userMessages";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id } = await context.params;

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { references: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден или недоступен." }, { status: 404 });
  }

  try {
    const body = await _request.json().catch(() => null) as { referenceScriptsCount?: unknown } | null;
    const requestedReferenceScriptsCount = Number(body?.referenceScriptsCount ?? project.referenceScriptsCount);
    const hasReadyReferences = project.references.some(
      (reference) => reference.useInGeneration && reference.status === "ready" && reference.extractedScenarioText,
    );
    const referenceScriptsCount = hasReadyReferences && Number.isInteger(requestedReferenceScriptsCount)
      ? Math.min(Math.max(requestedReferenceScriptsCount, 0), project.scriptsCount)
      : 0;

    await prisma.project.update({
      where: { id: project.id },
      data: { referenceScriptsCount },
    });

    const scripts = await generateProjectScripts(project.id);
    return NextResponse.json({ scriptsCount: scripts.length });
  } catch (error) {
    const message = generationErrorMessage(error);

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "script_generation_failed", currentStep: "generation" },
    });

    await prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type: "scripts.generation_failed",
        payloadJson: JSON.stringify({ error: message }),
      },
    });

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
