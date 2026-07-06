export type GenerateScriptsPromptInput = {
  briefText: string;
  scriptsCount: number;
  generationComment: string | null;
  referenceScriptsCount: number;
  questions: Array<{
    question: string;
    answer: string | null;
  }>;
  references: Array<{
    context: string;
  }>;
  styleContext: string;
};

export type GenerateSingleScriptPromptInput = {
  briefText: string;
  scriptNumber: number;
  scriptsCount: number;
  basedOnReference: boolean;
  generationComment: string | null;
  questions: Array<{
    question: string;
    answer: string | null;
  }>;
  references: Array<{
    context: string;
  }>;
  styleContext: string;
  previousScripts: Array<{
    number: number;
    title: string;
    format: string;
  }>;
};

export const generateScriptsSystemPrompt = [
  "You write native Russian UGC scripts for short vertical videos.",
  "Return only valid JSON. No markdown, no commentary, no trailing text.",
  "The scripts must feel like real life, not like advertising.",
  "The product must appear through the creator's action inside a concrete life situation.",
  "Never write a classic commercial, direct sales pitch, or dry advertising copy.",
].join("\n");

export function buildGenerateScriptsUserPrompt(input: GenerateScriptsPromptInput) {
  return [
    "Generate UGC scripts and return JSON with this exact shape. Create one separate object per script:",
    JSON.stringify(
      {
        scripts: [
          {
            number: 1,
            title: "...",
            format: "...",
            idea: "...",
            text: "0-3 сек: ...\n3-7 сек: ...\n7-12 сек: ...\n12-18 сек: ...\n18-25 сек: ...\n25-30 сек: ...",
            integration: "...",
            whyNative: "...",
            basedOnReference: true,
            referenceReason: "...",
          },
        ],
      },
      null,
      2,
    ),
    "",
    "Hard requirements:",
    `- Generate exactly ${input.scriptsCount} scripts.`,
    `- referenceScriptsCount = ${input.referenceScriptsCount}. If it is greater than 0, scripts 1 through ${input.referenceScriptsCount} must be based on project references.`,
    "- Set `basedOnReference: true` only for those first reference-based scripts. Set it to false for all other scripts.",
    "- For every reference-based script, explain in `referenceReason` what structure, pace, visual pattern, or delivery was borrowed. For non-reference scripts, use an empty string.",
    "- Every script, including non-reference scripts, must be equally detailed and production-ready.",
    "- Each script must be different by situation, hook, structure, and product entry.",
    "- Write in Russian.",
    "- Keep the text convenient for human editing: clear blocks, short lines, concrete shots/actions, spoken lines, captions.",
    "- The `text` field must be the full editable script, not a summary and not a list of style notes.",
    "- The `text` field must be written by seconds with time ranges. Use the timing from the brief when it exists.",
    "- If the brief says scripts must be 30 seconds, write ranges that cover 0-30 seconds. If it says 15 seconds, cover 0-15 seconds. If no timing is specified, cover 0-30 seconds.",
    "- Each time range must include what is visible in the frame, action of the hero, spoken text or VO, captions when needed, and where the product appears.",
    "- Do not write placeholders like 'hook', 'style of conversation', 'visual pattern', 'show product', or 'add caption' instead of actual script content.",
    "- Do not combine several scenarios inside one `text` field. One object equals one full scenario.",
    "- Scripts must be native and feel like content the creator would actually publish.",
    "- Do not make a classic advertising video with a product presentation, slogan block, or direct call to buy.",
    "- The product must appear through an action of the hero in the scene.",
    "- Do not use dry advertising formulations or generic marketing benefits.",
    "- Use the brief as the source of product mechanics, required claims, limitations, prohibitions, deadlines, legal notes, and chronology.",
    "- Follow all limitations and mandatory constraints from the brief.",
    "- If the brief contains mandatory mechanics, conditions, dates, disclaimers, visual requirements, or forbidden claims, preserve them exactly in meaning.",
    "- Do not invent unavailable product features, prices, guarantees, locations, props, awards, or restrictions.",
    "- Account for the creator's generation comment. Treat it as direction unless it conflicts with the brief.",
    "- Account for confirmed answers to clarification questions.",
    "- Avoid direct ad language, generic praise, dry benefit lists, and phrases like 'купите', 'лучший продукт', 'идеальное решение'.",
    "- The product should appear because the hero does something believable, not because the script pauses for an ad block.",
    "- Respect timing from the brief. If there is no exact timing, write for 30-60 seconds.",
    "- Use StyleCase examples and style rules from the style context, but do not copy them literally.",
    "- Never literally copy wording, scenes, jokes, captions, or phrase order from StyleCase examples or project references.",
    "- For project references, borrow only the structure, pace, visual pattern, delivery, density, entry mechanics, and ending logic.",
    "- Scripts after the first referenceScriptsCount items must rely on the brief, creator comment, answers, and style context. They must not become generic filler.",
    "",
    input.styleContext,
    "",
    "Creator generation comment:",
    input.generationComment?.trim() || "No extra generation comment.",
    "",
    "Project references:",
    input.references.length
      ? input.references
          .map((reference) => reference.context)
          .join("\n\n")
      : "No project references.",
    "",
    "Clarification answers:",
    input.questions.length
      ? input.questions
          .map((question) => `Q: ${question.question}\nA: ${question.answer?.trim() || "No answer yet."}`)
          .join("\n\n")
      : "No clarification questions.",
    "",
    "Advertising brief:",
    input.briefText,
  ].join("\n");
}

export function buildGenerateSingleScriptUserPrompt(input: GenerateSingleScriptPromptInput) {
  return [
    "Generate exactly one UGC script and return JSON with this exact shape:",
    JSON.stringify(
      {
        script: {
          number: input.scriptNumber,
          title: "...",
          format: "...",
          idea: "...",
          text: "0-3 сек: ...\n3-7 сек: ...\n7-12 сек: ...\n12-18 сек: ...\n18-25 сек: ...\n25-30 сек: ...",
          integration: "...",
          whyNative: "...",
          basedOnReference: input.basedOnReference,
          referenceReason: input.basedOnReference ? "..." : "",
        },
      },
      null,
      2,
    ),
    "",
    "Hard requirements:",
    `- Generate script #${input.scriptNumber} of ${input.scriptsCount}.`,
    "- Return exactly one `script` object, not an array.",
    `- This script ${input.basedOnReference ? "must be based on project references" : "must not be forced to follow project references"}.`,
    `- Set basedOnReference to ${input.basedOnReference ? "true" : "false"}.`,
    input.basedOnReference
      ? "- In `referenceReason`, briefly explain what structure, pace, visual pattern, or delivery was borrowed from references."
      : "- Set `referenceReason` to an empty string.",
    input.basedOnReference
      ? "- First infer the reference format mechanics from Project references: speaker setup, camera relationship, delivery mechanic, editing rhythm, information flow, and product-entry pattern. Preserve those mechanics in the new script."
      : "- Do not imitate project references for this non-reference script.",
    "- Write in Russian.",
    "- The `text` field must be a complete editable script by seconds, not a summary.",
    "- Use the timing from the brief. If there is no exact timing, cover 0-30 seconds.",
    "- Every time range must include frame/action, spoken line or VO, captions where useful, and product appearance.",
    "- Do not write placeholders like 'hook', 'style of conversation', 'visual pattern', 'show product', or 'add caption'.",
    "- Make the script native: no classic commercial, no slogan block, no dry benefit list, no direct sales pitch.",
    input.basedOnReference
      ? "- Integrate the product through the same kind of format mechanic as the reference: demonstration, proof, conversation, screen walkthrough, objection handling, direct-to-camera explanation, or other mechanic detected from the reference. Do not invent a separate life situation if the reference is not built as a life situation."
      : "- Product must appear through the hero's believable action in the scene.",
    "- Follow all mandatory mechanics, limits, deadlines, legal notes, chronology, forbidden claims, and visual requirements from the brief.",
    "- Do not invent unavailable features, prices, guarantees, locations, props, awards, or restrictions.",
    "- Account for the creator's generation comment unless it conflicts with the brief.",
    "- Account for confirmed answers to clarification questions.",
    "- Use style rules and StyleCase patterns, but do not copy StyleCase wording or scenes literally.",
    "- If a style rule conflicts with the selected project reference format, follow the project reference format for reference-based scripts.",
    input.basedOnReference
      ? "- In `referenceReason`, explicitly name the preserved format mechanics, not just 'structure' or 'tone'."
      : "",
    "- Make this script meaningfully different from previous scripts by situation, hook, structure, and product entry.",
    "",
    "Previous scripts in this generation:",
    input.previousScripts.length
      ? input.previousScripts
          .map((script) => `${script.number}. ${script.title} (${script.format})`)
          .join("\n")
      : "No previous scripts yet.",
    "",
    input.styleContext,
    "",
    "Creator generation comment:",
    input.generationComment?.trim() || "No extra generation comment.",
    "",
    "Project references:",
    input.basedOnReference && input.references.length
      ? input.references.map((reference) => reference.context).join("\n\n")
      : "Do not use project references for this script.",
    "",
    "Clarification answers:",
    input.questions.length
      ? input.questions
          .map((question) => `Q: ${question.question}\nA: ${question.answer?.trim() || "No answer yet."}`)
          .join("\n\n")
      : "No clarification questions.",
    "",
    "Advertising brief:",
    input.briefText,
  ].join("\n");
}
