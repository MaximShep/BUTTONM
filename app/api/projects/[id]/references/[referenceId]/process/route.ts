import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processReference } from "@/lib/references/processReference";
import { referenceErrorMessage } from "@/lib/userMessages";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; referenceId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, referenceId } = await context.params;
  const reference = await prisma.projectReference.findFirst({
    where: {
      id: referenceId,
      projectId: id,
      project: { userId: user.id },
    },
    select: { id: true },
  });

  if (!reference) {
    return NextResponse.json({ error: "Референс не найден или уже удалён." }, { status: 404 });
  }

  const result = await processReference(reference.id);
  if (!result) {
    const failed = await prisma.projectReference.findUnique({
      where: { id: reference.id },
      select: { error: true },
    });
    return NextResponse.json({ error: referenceErrorMessage(failed?.error) }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
