import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeBriefQuestionsAndReplace } from "@/lib/projects/briefQuestions";
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
    select: { id: true, briefText: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден или недоступен." }, { status: 404 });
  }

  try {
    const analysis = await analyzeBriefQuestionsAndReplace(project.id, project.briefText);

    return NextResponse.json({
      readyToGenerate: analysis.readyToGenerate,
      summary: analysis.summary,
      questionsCount: analysis.questions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: generationErrorMessage(error) },
      { status: 502 },
    );
  }
}
