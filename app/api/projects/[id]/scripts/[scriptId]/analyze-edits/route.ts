import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { analyzeScriptEditsAndLearn } from "@/lib/projects/styleLearning";
import { generationErrorMessage } from "@/lib/userMessages";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; scriptId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, scriptId } = await context.params;

  try {
    const result = await analyzeScriptEditsAndLearn({
      userId: user.id,
      projectId: id,
      scriptId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage === "Script not found."
      ? "Сценарий не найден или уже удалён."
      : generationErrorMessage(error);
    const status = rawMessage === "Script not found." ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
