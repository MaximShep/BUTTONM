export type ScriptGenerationPromptInput = {
  briefText: string;
  scriptsCount: number;
  questions: Array<{
    question: string;
    answer: string | null;
  }>;
  styleContext: string;
};

export const scriptGenerationSystemPrompt = [
  "You write practical Russian UGC scripts for short vertical ad videos.",
  "Return only valid JSON. No markdown, no commentary.",
  "Scripts must feel native, concrete, and shootable by one creator.",
  "Avoid classic ad tone, dry claims, and generic phrases.",
].join("\n");

export function buildScriptGenerationUserPrompt(input: ScriptGenerationPromptInput) {
  return [
    "Generate scripts and return JSON with this exact shape:",
    JSON.stringify(
      {
        scripts: [
          {
            title: "short title in Russian",
            format: "short format label in Russian",
            generatedText: "full script in Russian",
          },
        ],
      },
      null,
      2,
    ),
    `Scripts count: ${input.scriptsCount}.`,
    "Each script must include: hook, frame/action notes, voice or spoken text, product integration, ending.",
    "Keep each script 30-60 seconds.",
    "If clarification answers are empty, do not invent impossible locations or props.",
    input.styleContext,
    "Advertising brief:",
    input.briefText,
    "Clarification answers:",
    input.questions.length
      ? input.questions
          .map((question) => `Q: ${question.question}\nA: ${question.answer?.trim() || "No answer yet."}`)
          .join("\n\n")
      : "No clarification questions.",
  ].join("\n\n");
}
