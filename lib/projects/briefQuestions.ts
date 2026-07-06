import "server-only";

import { generateText } from "@/lib/llm/gateway";
import {
  analyzeBriefSystemPrompt,
  buildAnalyzeBriefUserPrompt,
} from "@/lib/prompts/analyzeBriefPrompt";
import { prisma } from "@/lib/prisma";

type LLMQuestion = {
  question: unknown;
  importance: unknown;
};

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("LLM response does not contain a JSON object.");
}

function normalizeImportance(value: unknown) {
  return value === "high" ? value : null;
}

export function parseBriefQuestionAnalysis(text: string) {
  const parsed = JSON.parse(extractJson(text)) as {
    readyToGenerate?: unknown;
    summary?: unknown;
    questions?: unknown;
  };

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map((item): { question: string; importance: "high" } | null => {
          const candidate = item as LLMQuestion;
          const question = typeof candidate.question === "string" ? candidate.question.trim() : "";
          const importance = normalizeImportance(candidate.importance);

          if (!question || !importance) return null;
          return { question, importance };
        })
        .filter((item): item is { question: string; importance: "high" } => Boolean(item))
        .slice(0, 3)
    : [];

  return {
    readyToGenerate: Boolean(parsed.readyToGenerate) || questions.length === 0,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    questions,
  };
}

export async function analyzeBriefQuestions(projectId: string, briefText: string) {
  const result = await generateText({
    task: "analyze_brief_questions",
    projectId,
    systemPrompt: analyzeBriefSystemPrompt,
    userPrompt: buildAnalyzeBriefUserPrompt({ briefText }),
    temperature: 0.1,
    maxTokens: 1000,
  });

  return {
    ...parseBriefQuestionAnalysis(result.text),
    llmLogId: result.logId,
  };
}

export async function analyzeBriefQuestionsAndReplace(projectId: string, briefText: string) {
  const analysis = await analyzeBriefQuestions(projectId, briefText);
  const nextStatus = analysis.questions.length > 0 ? "questions_pending" : "questions_approved";
  const nextStep = analysis.questions.length > 0 ? "questions" : "generation";

  await prisma.$transaction([
    prisma.projectQuestion.deleteMany({ where: { projectId } }),
    prisma.projectQuestion.createMany({
      data: analysis.questions.map((question) => ({
        projectId,
        question: question.question,
        importance: question.importance,
      })),
    }),
    prisma.projectEvent.create({
      data: {
        projectId,
        type: "brief.questions_analyzed",
        payloadJson: JSON.stringify({
          readyToGenerate: analysis.readyToGenerate,
          summary: analysis.summary,
          questionsCount: analysis.questions.length,
          llmLogId: analysis.llmLogId,
        }),
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { status: nextStatus, currentStep: nextStep },
    }),
  ]);

  return analysis;
}
