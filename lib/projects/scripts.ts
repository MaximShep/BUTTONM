import "server-only";

import { generateText } from "@/lib/llm/gateway";
import {
  buildGenerateSingleScriptUserPrompt,
  generateScriptsSystemPrompt,
} from "@/lib/prompts/generateScriptsPrompt";
import {
  buildRegenerateScriptUserPrompt,
  regenerateScriptSystemPrompt,
} from "@/lib/prompts/regenerateScriptPrompt";
import { prisma } from "@/lib/prisma";
import { buildReferenceContext } from "@/lib/references/context";
import { buildStyleContext } from "@/lib/style/context";

type LLMScript = {
  number?: unknown;
  title: unknown;
  format: unknown;
  idea: unknown;
  text: unknown;
  generatedText?: unknown;
  timeline?: unknown;
  integration: unknown;
  finalCaption?: unknown;
  whyNative: unknown;
  basedOnReference?: unknown;
  referenceReason?: unknown;
};

type NormalizedScript = {
  title: string;
  format: string;
  generatedText: string;
  basedOnReference: boolean;
  referenceReason: string | null;
};

const MIN_SCRIPT_TEXT_LENGTH = 280;
const MIN_TIME_MARKERS = 3;
const NO_CONTENT_PLACEHOLDERS = [
  "hook style",
  "conversation style",
  "visual pattern",
  "стиль разговора",
  "визуальный паттерн",
  "добавить титр",
  "показать продукт",
];
const MAX_SINGLE_SCRIPT_TOKENS = 1800;
const NO_PROCESSED_REFERENCES_MESSAGE = "No processed references are ready for generation.";

function compactMiddle(text: string, maxLength: number) {
  const compacted = text.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) return compacted;

  const headLength = Math.floor(maxLength * 0.65);
  const tailLength = maxLength - headLength;
  return `${compacted.slice(0, headLength).trim()}\n\n[...]\n\n${compacted.slice(-tailLength).trim()}`;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("LLM вернул ответ без JSON-объекта.");
}

function escapeRawNewlinesInsideJsonStrings(text: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && char === "\n") {
      result += "\\n";
      continue;
    }

    if (inString && char === "\r") {
      result += "\\r";
      continue;
    }

    result += char;
  }

  return result;
}

function parseJsonObject(text: string) {
  const json = extractJson(text);

  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return JSON.parse(escapeRawNewlinesInsideJsonStrings(json)) as Record<string, unknown>;
  }
}

function repairJson(text: string) {
  return parseJsonObject(text);
}

function timeMarkerCount(text: string) {
  const matches = text.match(/(?:^|\n)\s*\d{1,2}\s*[-–—]\s*\d{1,2}\s*(?:сек|с\b|секунд)/gi);
  return matches?.length ?? 0;
}

function isFullTimedScript(text: string) {
  const lowerText = text.toLowerCase();
  const hasPlaceholderInsteadOfScript = NO_CONTENT_PLACEHOLDERS.some((placeholder) => lowerText.includes(placeholder));

  return (
    text.length >= MIN_SCRIPT_TEXT_LENGTH &&
    timeMarkerCount(text) >= MIN_TIME_MARKERS &&
    !hasPlaceholderInsteadOfScript
  );
}

function normalizeLlmScript(item: unknown) {
  const candidate = item as LLMScript;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const format = typeof candidate.format === "string" ? candidate.format.trim() : "";
  const idea = typeof candidate.idea === "string" ? candidate.idea.trim() : "";
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const legacyGeneratedText = typeof candidate.generatedText === "string" ? candidate.generatedText.trim() : "";
  const scriptText = text || legacyGeneratedText;
  const timeline = typeof candidate.timeline === "string" ? candidate.timeline.trim() : "";
  const integration = typeof candidate.integration === "string" ? candidate.integration.trim() : "";
  const finalCaption = typeof candidate.finalCaption === "string" ? candidate.finalCaption.trim() : "";
  const whyNative = typeof candidate.whyNative === "string" ? candidate.whyNative.trim() : "";
  const basedOnReference = candidate.basedOnReference === true;
  const referenceReason = typeof candidate.referenceReason === "string" ? candidate.referenceReason.trim() : "";

  const generatedText = legacyGeneratedText && !text
    ? legacyGeneratedText
    : [
    idea ? `Идея:\n${idea}` : "",
    scriptText ? `Сценарий:\n${scriptText}` : "",
    timeline ? `Таймлайн:\n${timeline}` : "",
    integration ? `Интеграция продукта:\n${integration}` : "",
    finalCaption ? `Финальный титр:\n${finalCaption}` : "",
    whyNative ? `Почему нативно:\n${whyNative}` : "",
  ].filter(Boolean).join("\n\n");

  if (!title || !format || !scriptText || !isFullTimedScript(scriptText)) return null;
  return { title, format, generatedText, basedOnReference, referenceReason: referenceReason || null };
}

function parseGeneratedScript(text: string, scriptNumber: number, basedOnReference: boolean) {
  let parsed: { script?: unknown; scripts?: unknown };

  try {
    parsed = parseJsonObject(text) as { script?: unknown; scripts?: unknown };
  } catch {
    parsed = repairJson(text) as { script?: unknown; scripts?: unknown };
  }

  const source = parsed.script ?? (Array.isArray(parsed.scripts) ? parsed.scripts[0] : null);
  const script = normalizeLlmScript(source);

  if (!script) {
    throw new Error(`LLM вернул невалидный сценарий #${scriptNumber}.`);
  }

  return {
    ...script,
    basedOnReference,
    referenceReason: basedOnReference ? script.referenceReason : null,
  };
}

function parseRegeneratedScript(text: string) {
  const parsed = parseJsonObject(text) as { script?: unknown };
  const script = normalizeLlmScript(parsed.script);

  if (!script) {
    throw new Error("LLM response does not contain a valid script.");
  }

  return script;
}

export async function generateProjectScripts(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      questions: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "generating_scripts", currentStep: "generation" },
  });

  const styleContext = await buildStyleContext(project.userId, { includeExampleScriptText: false });
  const referenceContext = await buildReferenceContext(project.id);
  const hasReadyReferences = referenceContext !== NO_PROCESSED_REFERENCES_MESSAGE;
  const referenceScriptsCount = hasReadyReferences
    ? Math.min(Math.max(project.referenceScriptsCount, 0), project.scriptsCount)
    : 0;
  const questions = project.questions
    .filter((question) => question.answer?.trim())
    .map((question) => ({
      question: question.question,
      answer: question.answer,
    }));
  const references = hasReadyReferences ? [{ context: referenceContext }] : [];
  const scripts: NormalizedScript[] = [];
  const llmLogIds: string[] = [];

  for (let index = 0; index < project.scriptsCount; index += 1) {
    const scriptNumber = index + 1;
    const basedOnReference = index < referenceScriptsCount;
    const result = await generateText({
      task: "generate_scripts",
      projectId: project.id,
      systemPrompt: generateScriptsSystemPrompt,
      userPrompt: buildGenerateSingleScriptUserPrompt({
        briefText: compactMiddle(project.briefText, 6500),
        scriptNumber,
        scriptsCount: project.scriptsCount,
        basedOnReference,
        generationComment: project.generationComment,
        styleContext,
        questions,
        references,
        previousScripts: scripts.map((script, previousIndex) => ({
          number: previousIndex + 1,
          title: script.title,
          format: script.format,
        })),
      }),
      temperature: 0.72,
      maxTokens: MAX_SINGLE_SCRIPT_TOKENS,
    });

    llmLogIds.push(result.logId);
    scripts.push(parseGeneratedScript(result.text, scriptNumber, basedOnReference));
  }

  await prisma.$transaction([
    prisma.script.deleteMany({ where: { projectId: project.id } }),
    ...scripts.map((script, index) =>
      prisma.script.create({
        data: {
          projectId: project.id,
          number: index + 1,
          title: script.title,
          format: script.format,
          generatedText: script.generatedText,
          editedText: script.generatedText,
          basedOnReference: script.basedOnReference,
          referenceReason: script.referenceReason,
          status: "draft",
        },
      }),
    ),
    prisma.project.update({
      where: { id: project.id },
      data: { status: "scripts_generated", currentStep: "scripts" },
    }),
    prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type: "scripts.generated",
        payloadJson: JSON.stringify({
          scriptsCount: scripts.length,
          referenceScriptsCount,
          llmLogIds,
        }),
      },
    }),
  ]);

  return scripts;
}

export async function regenerateProjectScript(input: {
  userId: string;
  projectId: string;
  scriptId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Regeneration reason is required.");
  }

  const script = await prisma.script.findFirst({
    where: {
      id: input.scriptId,
      projectId: input.projectId,
      project: { userId: input.userId },
    },
    include: {
      project: {
        include: {
          questions: { orderBy: { createdAt: "asc" } },
          scripts: {
            where: { id: { not: input.scriptId } },
            orderBy: { number: "asc" },
            select: { number: true, title: true },
          },
        },
      },
    },
  });

  if (!script) {
    throw new Error("Script not found.");
  }

  const styleContext = await buildStyleContext(input.userId);
  const previousText = script.editedText ?? script.generatedText;

  const result = await generateText({
    task: "regenerate_script",
    projectId: script.projectId,
    systemPrompt: regenerateScriptSystemPrompt,
    userPrompt: buildRegenerateScriptUserPrompt({
      briefText: script.project.briefText,
      questions: script.project.questions.map((question) => ({
        question: question.question,
        answer: question.answer,
      })),
      styleContext,
      oldGeneratedText: script.generatedText,
      currentEditedText: previousText,
      reason,
      otherScripts: script.project.scripts,
    }),
    temperature: 0.75,
    maxTokens: 2500,
  });

  const regenerated = parseRegeneratedScript(result.text);

  const updated = await prisma.$transaction(async (tx) => {
    const revision = await tx.scriptRevision.create({
      data: {
        scriptId: script.id,
        previousText,
        newText: regenerated.generatedText,
        changeNote: `Перегенерация: ${reason}`,
      },
      select: {
        id: true,
        changeNote: true,
        createdAt: true,
      },
    });

    const updatedScript = await tx.script.update({
      where: { id: script.id },
      data: {
        title: regenerated.title,
        format: regenerated.format,
        generatedText: regenerated.generatedText,
        editedText: regenerated.generatedText,
        status: "draft",
      },
      select: {
        id: true,
        title: true,
        format: true,
        generatedText: true,
        editedText: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.projectEvent.create({
      data: {
        projectId: script.projectId,
        type: "script.regenerated",
        payloadJson: JSON.stringify({
          scriptId: script.id,
          reason,
          revisionId: revision.id,
          llmLogId: result.logId,
        }),
      },
    });

    return { script: updatedScript, revision };
  });

  return updated;
}
