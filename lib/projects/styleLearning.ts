import "server-only";

import { generateText } from "@/lib/llm/gateway";
import {
  analyzeEditsSystemPrompt,
  buildAnalyzeEditsUserPrompt,
} from "@/lib/prompts/analyzeEditsPrompt";
import { prisma } from "@/lib/prisma";

type AnalyzeScriptEditsInput = {
  userId: string;
  projectId: string;
  scriptId: string;
};

type StyleLearningAnalysis = {
  summary: string;
  badPatterns: string[];
  goodPatterns: string[];
  newStyleRules: string[];
  phrasesToAvoid: string[];
  phrasesToPrefer: string[];
  styleCaseComment?: string;
};

const MIN_CHANGE_RATIO = 0.08;
const MIN_LENGTH_DELTA = 80;

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("LLM response does not contain a JSON object.");
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function similarityRatio(firstText: string, secondText: string) {
  const first = normalizeText(firstText);
  const second = normalizeText(secondText);
  if (!first && !second) return 1;
  if (!first || !second) return 0;

  const firstWords = first.toLowerCase().split(" ");
  const secondWords = second.toLowerCase().split(" ");
  const counts = new Map<string, number>();

  for (const word of firstWords) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  let shared = 0;
  for (const word of secondWords) {
    const count = counts.get(word) ?? 0;
    if (count > 0) {
      shared += 1;
      counts.set(word, count - 1);
    }
  }

  return (2 * shared) / (firstWords.length + secondWords.length);
}

export function hasEnoughEditsForStyleLearning(generatedText: string, editedText: string) {
  const generated = normalizeText(generatedText);
  const edited = normalizeText(editedText);
  if (!generated || !edited || generated === edited) return false;

  const lengthDelta = Math.abs(generated.length - edited.length);
  const changedRatio = 1 - similarityRatio(generated, edited);

  return changedRatio >= MIN_CHANGE_RATIO || lengthDelta >= MIN_LENGTH_DELTA;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
}

function parseStyleLearningAnalysis(text: string): StyleLearningAnalysis {
  const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    badPatterns: cleanStringArray(parsed.badPatterns),
    goodPatterns: cleanStringArray(parsed.goodPatterns),
    newStyleRules: cleanStringArray(parsed.newStyleRules),
    phrasesToAvoid: cleanStringArray(parsed.phrasesToAvoid),
    phrasesToPrefer: cleanStringArray(parsed.phrasesToPrefer),
    styleCaseComment: typeof parsed.styleCaseComment === "string" ? parsed.styleCaseComment.trim() : "",
  };
}

function listOrEmpty(items: string[]) {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "Нет данных.";
}

function buildReferenceLearningPrompt(input: {
  project: {
    title: string;
    brand: string;
    briefText: string;
    generationComment: string | null;
  };
  script: {
    title: string;
    format: string;
    generatedText: string;
    editedText: string;
  };
  questions: Array<{ question: string; answer: string | null }>;
  references: string[];
  existingStyleRules: string[];
}) {
  return [
    "Analyze an explicitly client-approved Russian UGC ad script as a style reference.",
    "Return JSON with this exact shape:",
    JSON.stringify(
      {
        summary: "short summary in Russian",
        goodPatterns: ["specific reusable pattern from the final approved script"],
        badPatterns: ["specific generated pattern to avoid if visible from comparison"],
        phrasesToPrefer: ["wording type or phrase style to prefer"],
        phrasesToAvoid: ["wording type or phrase style to avoid"],
        newStyleRules: ["specific reusable rule for future generation"],
        styleCaseComment: "why this approved script is a useful style reference",
      },
      null,
      2,
    ),
    "Quality bar:",
    "- Use the brief, creator comment, answers, references, generated version, and final version.",
    "- Infer only preferences supported by this approved case.",
    "- Do not copy the final script literally into rules.",
    "- Rules must be operational: name where in the script the behavior applies and what to do.",
    "- Avoid generic wording: живее, нативнее, естественнее, проще, интереснее, короче, менее рекламно.",
    "- Return 1-5 newStyleRules.",
    "- Write all returned text in Russian.",
    "",
    "Project:",
    `Title: ${input.project.title}`,
    `Brand: ${input.project.brand}`,
    "",
    "Brief:",
    input.project.briefText,
    "",
    "Creator generation comment:",
    input.project.generationComment?.trim() || "Нет комментария.",
    "",
    "Clarification answers:",
    input.questions.length
      ? input.questions.map((item) => `Q: ${item.question}\nA: ${item.answer?.trim() || "Нет ответа."}`).join("\n\n")
      : "Нет ответов.",
    "",
    "Project references:",
    listOrEmpty(input.references),
    "",
    "Existing style rules:",
    listOrEmpty(input.existingStyleRules),
    "",
    `Script title: ${input.script.title}`,
    `Script format: ${input.script.format}`,
    "",
    "Generated script:",
    input.script.generatedText,
    "",
    "Final approved script:",
    input.script.editedText,
  ].join("\n\n");
}

export async function analyzeScriptEditsAndLearn(input: AnalyzeScriptEditsInput) {
  const script = await prisma.script.findFirst({
    where: {
      id: input.scriptId,
      projectId: input.projectId,
      project: { userId: input.userId },
    },
    include: { project: true },
  });

  if (!script) {
    throw new Error("Script not found.");
  }

  const editedText = script.editedText ?? script.generatedText;
  if (!hasEnoughEditsForStyleLearning(script.generatedText, editedText)) {
    return { skipped: true as const, reason: "Правок мало, анализ не нужен" };
  }

  const existingRules = await prisma.styleRule.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const result = await generateText({
    task: "analyze_script_edits",
    projectId: script.projectId,
    systemPrompt: analyzeEditsSystemPrompt,
    userPrompt: buildAnalyzeEditsUserPrompt({
      generatedText: script.generatedText,
      editedText,
      existingStyleRules: existingRules.map((rule) => rule.rule),
      projectContext: {
        title: script.project.title,
        brand: script.project.brand,
        briefText: script.project.briefText,
        scriptTitle: script.title,
        scriptFormat: script.format,
      },
    }),
    temperature: 0.1,
    maxTokens: 1600,
  });

  const analysis = parseStyleLearningAnalysis(result.text);

  const saved = await prisma.$transaction(async (tx) => {
    const learning = await tx.styleLearning.create({
      data: {
        userId: input.userId,
        scriptId: script.id,
        summary: analysis.summary || "Правки проанализированы.",
        badPatternsJson: JSON.stringify(analysis.badPatterns),
        goodPatternsJson: JSON.stringify(analysis.goodPatterns),
        phrasesToAvoidJson: JSON.stringify(analysis.phrasesToAvoid),
        phrasesToPreferJson: JSON.stringify(analysis.phrasesToPrefer),
      },
      select: {
        id: true,
        summary: true,
        badPatternsJson: true,
        goodPatternsJson: true,
        phrasesToAvoidJson: true,
        phrasesToPreferJson: true,
        createdAt: true,
      },
    });

    const existingRuleTexts = new Set(existingRules.map((rule) => rule.rule.trim().toLowerCase()));
    const newRules = analysis.newStyleRules.filter((rule) => !existingRuleTexts.has(rule.toLowerCase()));

    if (newRules.length) {
      await tx.styleRule.createMany({
        data: newRules.map((rule) => ({
          userId: input.userId,
          rule,
          source: "script_edits",
        })),
      });
    }

    await tx.projectEvent.create({
      data: {
        projectId: script.projectId,
        type: "style.edits_analyzed",
        payloadJson: JSON.stringify({
          scriptId: script.id,
          styleLearningId: learning.id,
          newRulesCount: newRules.length,
          llmLogId: result.logId,
        }),
      },
    });

    return { learning, newRules };
  });

  return {
    skipped: false as const,
    summary: saved.learning.summary,
    badPatterns: JSON.parse(saved.learning.badPatternsJson) as string[],
    goodPatterns: JSON.parse(saved.learning.goodPatternsJson) as string[],
    phrasesToAvoid: JSON.parse(saved.learning.phrasesToAvoidJson) as string[],
    phrasesToPrefer: JSON.parse(saved.learning.phrasesToPreferJson) as string[],
    newStyleRules: saved.newRules,
    createdAt: saved.learning.createdAt,
  };
}

export async function saveApprovedScriptAsStyleReference(input: AnalyzeScriptEditsInput) {
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
          references: {
            where: { useInGeneration: true },
            orderBy: { createdAt: "asc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!script) {
    throw new Error("Script not found.");
  }

  if (script.status !== "approved_by_client") {
    throw new Error("Запоминать как эталон можно только сценарии, одобренные заказчиком.");
  }

  if (script.isStyleReference) {
    throw new Error("Этот сценарий уже сохранен как эталон.");
  }

  const editedText = script.editedText ?? script.generatedText;
  const existingRules = await prisma.styleRule.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const references = script.project.references
    .map((reference, index) => {
      const parts = [
        `Reference ${index + 1}`,
        reference.extractedScenarioText ? `Scenario: ${reference.extractedScenarioText}` : "",
        reference.notes ? `Notes: ${reference.notes}` : "",
        reference.transcriptText ? `Transcript: ${reference.transcriptText.slice(0, 1500)}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .filter(Boolean);

  const result = await generateText({
    task: "save_approved_script_style_reference",
    projectId: script.projectId,
    systemPrompt: [
      "You analyze approved UGC scripts to build future style memory.",
      "Return only valid JSON. No markdown, no commentary.",
    ].join("\n"),
    userPrompt: buildReferenceLearningPrompt({
      project: {
        title: script.project.title,
        brand: script.project.brand,
        briefText: script.project.briefText,
        generationComment: script.project.generationComment,
      },
      script: {
        title: script.title,
        format: script.format,
        generatedText: script.generatedText,
        editedText,
      },
      questions: script.project.questions.map((question) => ({
        question: question.question,
        answer: question.answer,
      })),
      references,
      existingStyleRules: existingRules.map((rule) => rule.rule),
    }),
    temperature: 0.1,
    maxTokens: 1800,
  });

  const analysis = parseStyleLearningAnalysis(result.text);

  const saved = await prisma.$transaction(async (tx) => {
    const learning = await tx.styleLearning.create({
      data: {
        userId: input.userId,
        scriptId: script.id,
        summary: analysis.summary || "Одобренный сценарий сохранен как стилевой ориентир.",
        badPatternsJson: JSON.stringify(analysis.badPatterns),
        goodPatternsJson: JSON.stringify(analysis.goodPatterns),
        phrasesToAvoidJson: JSON.stringify(analysis.phrasesToAvoid),
        phrasesToPreferJson: JSON.stringify(analysis.phrasesToPrefer),
      },
      select: {
        id: true,
        summary: true,
        badPatternsJson: true,
        goodPatternsJson: true,
        phrasesToAvoidJson: true,
        phrasesToPreferJson: true,
        createdAt: true,
      },
    });

    const existingRuleTexts = new Set(existingRules.map((rule) => rule.rule.trim().toLowerCase()));
    const newRules = analysis.newStyleRules.filter((rule) => !existingRuleTexts.has(rule.toLowerCase()));

    if (newRules.length) {
      await tx.styleRule.createMany({
        data: newRules.map((rule) => ({
          userId: input.userId,
          rule,
          source: "approved_script_reference",
        })),
      });
    }

    const styleCase = await tx.styleExample.create({
      data: {
        userId: input.userId,
        title: `Одобренный сценарий: ${script.title}`,
        briefText: script.project.briefText,
        scriptsText: editedText,
        finalScriptsText: editedText,
        comment: analysis.styleCaseComment || analysis.summary || "Сценарий одобрен заказчиком и сохранен как эталон.",
        active: true,
      },
      select: { id: true },
    });

    const updatedScript = await tx.script.update({
      where: { id: script.id },
      data: { isStyleReference: true },
      select: { id: true, status: true, isStyleReference: true },
    });

    await tx.projectEvent.create({
      data: {
        projectId: script.projectId,
        type: "script_saved_as_style_reference",
        payloadJson: JSON.stringify({
          scriptId: script.id,
          styleLearningId: learning.id,
          styleCaseId: styleCase.id,
          newRulesCount: newRules.length,
          llmLogId: result.logId,
        }),
      },
    });

    return { learning, newRules, styleCase, script: updatedScript };
  });

  return {
    skipped: false as const,
    script: saved.script,
    styleCaseId: saved.styleCase.id,
    summary: saved.learning.summary,
    badPatterns: JSON.parse(saved.learning.badPatternsJson) as string[],
    goodPatterns: JSON.parse(saved.learning.goodPatternsJson) as string[],
    phrasesToAvoid: JSON.parse(saved.learning.phrasesToAvoidJson) as string[],
    phrasesToPrefer: JSON.parse(saved.learning.phrasesToPreferJson) as string[],
    newStyleRules: saved.newRules,
    styleCaseComment: analysis.styleCaseComment,
    createdAt: saved.learning.createdAt,
  };
}
