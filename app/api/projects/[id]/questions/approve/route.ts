import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AnswerInput = {
  questionId?: unknown;
  answer?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { answers?: unknown } | null;
  const answers = Array.isArray(body?.answers) ? body.answers : [];

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { questions: { select: { id: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден или недоступен." }, { status: 404 });
  }

  const questionIds = new Set(project.questions.map((question) => question.id));
  const normalizedAnswers = answers
    .map((item) => item as AnswerInput)
    .map((item) => ({
      questionId: typeof item.questionId === "string" ? item.questionId : "",
      answer: typeof item.answer === "string" ? item.answer.trim() : "",
    }))
    .filter((item) => questionIds.has(item.questionId));

  if (normalizedAnswers.length !== project.questions.length) {
    return NextResponse.json({ error: "Ответьте на все вопросы перед подтверждением." }, { status: 400 });
  }

  if (normalizedAnswers.some((item) => !item.answer)) {
    return NextResponse.json({ error: "Ответьте на все вопросы перед подтверждением." }, { status: 400 });
  }

  await prisma.$transaction([
    ...normalizedAnswers.map((item) =>
      prisma.projectQuestion.update({
        where: { id: item.questionId },
        data: { answer: item.answer },
      }),
    ),
    prisma.project.update({
      where: { id: project.id },
      data: { status: "questions_approved", currentStep: "generation" },
    }),
    prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type: "questions.approved",
        payloadJson: JSON.stringify({ questionsCount: normalizedAnswers.length }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
