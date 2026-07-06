import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { regenerateProjectScript } from "@/lib/projects/scripts";
import { generationErrorMessage } from "@/lib/userMessages";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; scriptId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireUser();
  const { id, scriptId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "Укажите, что не так с этим сценарием." }, { status: 400 });
  }

  try {
    const result = await regenerateProjectScript({
      userId: user.id,
      projectId: id,
      scriptId,
      reason,
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
