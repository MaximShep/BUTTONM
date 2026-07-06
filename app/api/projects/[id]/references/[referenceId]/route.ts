import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; referenceId: string }>;
};

async function findOwnedReference(projectId: string, referenceId: string, userId: string) {
  return prisma.projectReference.findFirst({
    where: {
      id: referenceId,
      projectId,
      project: { userId },
    },
    select: { id: true, projectId: true },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, referenceId } = await context.params;
  const reference = await findOwnedReference(id, referenceId, user.id);

  if (!reference) {
    return NextResponse.json({ error: "Референс не найден или уже удалён." }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as {
    transcriptText?: unknown;
    notes?: unknown;
    useInGeneration?: unknown;
  } | null;

  await prisma.projectReference.update({
    where: { id: reference.id },
    data: {
      transcriptText: typeof body?.transcriptText === "string" ? body.transcriptText.trim() || null : undefined,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : undefined,
      useInGeneration: typeof body?.useInGeneration === "boolean" ? body.useInGeneration : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, referenceId } = await context.params;
  const reference = await findOwnedReference(id, referenceId, user.id);

  if (!reference) {
    return NextResponse.json({ error: "Референс не найден или уже удалён." }, { status: 404 });
  }

  await prisma.projectReference.delete({ where: { id: reference.id } });
  await prisma.projectEvent.create({
    data: {
      projectId: id,
      type: "reference.deleted",
      payloadJson: JSON.stringify({ referenceId }),
    },
  });

  return NextResponse.json({ ok: true });
}
