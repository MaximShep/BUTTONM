import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateText } from "@/lib/llm/gateway";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function findProject(userId: string, projectId?: string | null) {
  if (projectId) {
    return prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, title: true, briefText: true },
    });
  }

  return prisma.project.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, briefText: true },
  });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await requireUser();
  const projectId = request.nextUrl.searchParams.get("projectId");
  const project = await findProject(user.id, projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found. Create a project first." }, { status: 404 });
  }

  const result = await generateText({
    task: "llm_smoke_test",
    projectId: project.id,
    systemPrompt: "You are a concise assistant for testing the LLM gateway.",
    userPrompt: `Reply with one short sentence. Project: ${project.title}. Brief preview: ${project.briefText.slice(0, 400)}`,
    temperature: 0.2,
    maxTokens: 120,
  });

  return NextResponse.json({ projectId: project.id, ...result });
}
