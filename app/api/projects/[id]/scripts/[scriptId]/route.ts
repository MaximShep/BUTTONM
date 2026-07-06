import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SCRIPT_STATUSES = new Set([
  "draft",
  "needs_revision",
  "approved_by_creator",
  "approved_by_client",
  "rejected",
  "reference_quality",
]);

type RouteContext = {
  params: Promise<{ id: string; scriptId: string }>;
};

type PatchBody = {
  editedText?: unknown;
  changeNote?: unknown;
  saveMode?: unknown;
  status?: unknown;
  rejectionReason?: unknown;
  approveByClient?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, scriptId } = await context.params;
  const body = await request.json().catch(() => null) as PatchBody | null;

  if (!body) {
    return NextResponse.json({ error: "Не удалось прочитать изменения. Обновите страницу и попробуйте ещё раз." }, { status: 400 });
  }

  const script = await prisma.script.findFirst({
    where: {
      id: scriptId,
      projectId: id,
      project: { userId: user.id },
    },
    include: {
      revisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!script) {
    return NextResponse.json({ error: "Сценарий не найден или уже удалён." }, { status: 404 });
  }

  const nextText = typeof body.editedText === "string" ? body.editedText : undefined;
  const nextStatus = typeof body.status === "string" ? body.status : undefined;
  const approveByClient = body.approveByClient === true;
  const saveMode = body.saveMode === "manual" ? "manual" : "auto";
  const changeNote = typeof body.changeNote === "string" ? body.changeNote.trim() : "";
  const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

  if (nextStatus && !SCRIPT_STATUSES.has(nextStatus)) {
    return NextResponse.json({ error: "Такой статус сценария не поддерживается." }, { status: 400 });
  }

  if (nextText === undefined && !nextStatus && !approveByClient) {
    return NextResponse.json({ error: "Нет изменений для сохранения." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const data: { editedText?: string; status?: string; approvedByClientAt?: Date } = {};
    if (nextText !== undefined) data.editedText = nextText;
    if (nextStatus) data.status = nextStatus;
    if (approveByClient) {
      data.status = "approved_by_client";
      data.approvedByClientAt = new Date();
    }

    const updatedScript = await tx.script.update({
      where: { id: script.id },
      data,
      select: {
        id: true,
        editedText: true,
        status: true,
        approvedByClientAt: true,
        isStyleReference: true,
        updatedAt: true,
      },
    });

    let revision = null;
    if (saveMode === "manual" && nextText !== undefined) {
      const previousText = script.revisions[0]?.newText ?? script.generatedText;

      if (previousText !== nextText) {
        revision = await tx.scriptRevision.create({
          data: {
            scriptId: script.id,
            previousText,
            newText: nextText,
            changeNote: changeNote || null,
          },
          select: {
            id: true,
            changeNote: true,
            createdAt: true,
          },
        });
      }
    }

    let event = null;
    if (nextStatus === "rejected") {
      event = await tx.projectEvent.create({
        data: {
          projectId: script.projectId,
          type: "script.rejected_not_style",
          payloadJson: JSON.stringify({
            scriptId: script.id,
            reason: rejectionReason,
          }),
        },
        select: { id: true, createdAt: true },
      });
    }

    if (approveByClient) {
      event = await tx.projectEvent.create({
        data: {
          projectId: script.projectId,
          type: "script_approved_by_client",
          payloadJson: JSON.stringify({
            scriptId: script.id,
          }),
        },
        select: { id: true, createdAt: true },
      });
    }

    return { script: updatedScript, revision, event };
  });

  return NextResponse.json(result);
}
