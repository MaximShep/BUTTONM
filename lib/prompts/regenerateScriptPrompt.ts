export type RegenerateScriptPromptInput = {
  briefText: string;
  questions: Array<{
    question: string;
    answer: string | null;
  }>;
  styleContext: string;
  oldGeneratedText: string;
  currentEditedText: string;
  reason: string;
  otherScripts: Array<{
    number: number;
    title: string;
  }>;
};

export const regenerateScriptSystemPrompt = [
  "You rewrite one Russian UGC script for a short vertical ad video.",
  "Return only valid JSON. No markdown, no commentary, no trailing text.",
  "The result must be a new version of one script, not a full project generation.",
  "The script must feel like real life, not like advertising.",
  "Respect the user's regeneration reason and avoid repeating other scripts in the project.",
].join("\n");

export function buildRegenerateScriptUserPrompt(input: RegenerateScriptPromptInput) {
  return [
    "Regenerate exactly one UGC script and return JSON with this exact shape:",
    JSON.stringify(
      {
        script: {
          title: "...",
          format: "...",
          idea: "...",
          text: "...",
          integration: "...",
          whyNative: "...",
        },
      },
      null,
      2,
    ),
    "",
    "Hard requirements:",
    "- Generate exactly one script.",
    "- Write in Russian.",
    "- Keep the script convenient for human editing: clear blocks, short lines, concrete shots/actions, spoken lines, captions.",
    "- The `text` field must be the full editable script and include: hook, timeline, frame/action notes, spoken text or VO, product integration, final caption.",
    "- JSON strings must escape line breaks as \\n. Do not put raw line breaks inside string values.",
    "- Use the brief as the source of product mechanics, required claims, limitations, prohibitions, deadlines, legal notes, and chronology.",
    "- Preserve mandatory brief requirements exactly in meaning.",
    "- Do not invent unavailable product features, prices, guarantees, locations, props, awards, or restrictions.",
    "- Avoid direct ad language, generic praise, dry benefit lists, and phrases like 'купите', 'лучший продукт', 'идеальное решение'.",
    "- The product should appear because the hero does something believable, not because the script pauses for an ad block.",
    "- Use the blogger tone and mechanics from the style context.",
    "- Never literally copy wording, scenes, jokes, captions, or phrase order from reference examples.",
    "- Do not repeat the situations, hooks, or titles of other scripts in this project.",
    "",
    "Regeneration reason:",
    input.reason,
    "",
    "Other scripts in this project to avoid repeating:",
    input.otherScripts.length
      ? input.otherScripts.map((script) => `${script.number}. ${script.title}`).join("\n")
      : "No other scripts.",
    "",
    input.styleContext,
    "",
    "Clarification answers:",
    input.questions.length
      ? input.questions
          .map((question) => `Q: ${question.question}\nA: ${question.answer?.trim() || "No answer yet."}`)
          .join("\n\n")
      : "No clarification questions.",
    "",
    "Old generated script:",
    input.oldGeneratedText,
    "",
    "Current edited script:",
    input.currentEditedText,
    "",
    "Advertising brief:",
    input.briefText,
  ].join("\n");
}
