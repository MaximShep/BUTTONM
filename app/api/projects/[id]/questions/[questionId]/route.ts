import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; questionId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, questionId } = await context.params;
  const body = await request.json().catch(() => null) as { answer?: unknown } | null;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";

  const question = await prisma.projectQuestion.findFirst({
    where: {
      id: questionId,
      project: { id, userId: user.id },
    },
    select: { id: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Вопрос не найден или уже не актуален." }, { status: 404 });
  }

  const updatedQuestion = await prisma.projectQuestion.update({
    where: { id: question.id },
    data: { answer: answer || null },
    select: {
      id: true,
      answer: true,
      updatedAt: true,
    },
  });

  await prisma.project.update({
    where: { id },
    data: { status: "questions_pending", currentStep: "questions" },
  });

  return NextResponse.json(updatedQuestion);
}
