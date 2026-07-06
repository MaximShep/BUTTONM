export type AnalyzeEditsPromptInput = {
  generatedText: string;
  editedText: string;
  existingStyleRules: string[];
  projectContext: {
    title: string;
    brand: string;
    briefText: string;
    scriptTitle: string;
    scriptFormat: string;
  };
};

function listOrEmpty(items: string[]) {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "Правил пока нет.";
}

export const analyzeEditsSystemPrompt = [
  "You analyze edits made by a Russian-speaking UGC creator to a generated ad script.",
  "Your job is to infer practical style rules from the difference between the generated version and the final edited version.",
  "Return only rules that would help future script generation imitate the creator's editing preferences.",
  "Rules must be specific and operational, not abstract.",
  "Bad rule: писать живее.",
  "Good rule: не объяснять механику акции голосом, показывать её через действие в приложении.",
  "Bad rule: меньше рекламы.",
  "Good rule: заменять прямые рекламные обещания на личное наблюдение в бытовой ситуации.",
  "Do not invent preferences that are not supported by the edits.",
  "Do not repeat existing style rules unless the edit makes them more specific.",
  "Prefer concrete instructions about hooks, scenes, product integration, wording, pacing, captions, endings, and what to avoid.",
  "Write all returned text in Russian.",
  "Return only valid JSON. No markdown, no commentary.",
].join("\n");

export function buildAnalyzeEditsUserPrompt(input: AnalyzeEditsPromptInput) {
  return [
    "Compare the generated script and the edited script. Return JSON with this exact shape:",
    JSON.stringify(
      {
        summary: "short summary in Russian",
        badPatterns: ["specific generated pattern the creator removed or corrected"],
        goodPatterns: ["specific edited pattern the creator added or preferred"],
        newStyleRules: ["specific reusable rule for future generation"],
        phrasesToAvoid: ["phrase or wording type to avoid"],
        phrasesToPrefer: ["phrase or wording type to prefer"],
      },
      null,
      2,
    ),
    "Quality bar:",
    "- Each newStyleRules item must be usable as an instruction for the next generation.",
    "- Each rule must name the concrete behavior: what to replace, where in the script, and with what kind of alternative.",
    "- Avoid generic wording: живее, нативнее, естественнее, проще, интереснее, короче, менее рекламно.",
    "- If a generic idea is true, convert it into an observable instruction from the edit.",
    "- Return 1-5 newStyleRules. If the edits do not support new rules, return an empty array.",
    "- Keep lists short: up to 5 items each.",
    "",
    "Project context:",
    `Project title: ${input.projectContext.title}`,
    `Brand: ${input.projectContext.brand}`,
    `Script title: ${input.projectContext.scriptTitle}`,
    `Script format: ${input.projectContext.scriptFormat}`,
    "",
    "Brief:",
    input.projectContext.briefText,
    "",
    "Existing StyleRule:",
    listOrEmpty(input.existingStyleRules),
    "",
    "Generated script:",
    input.generatedText,
    "",
    "Edited final script:",
    input.editedText,
  ].join("\n\n");
}
