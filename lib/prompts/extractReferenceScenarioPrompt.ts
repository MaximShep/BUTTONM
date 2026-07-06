export type ExtractReferenceScenarioPromptInput = {
  type: string;
  source: string | null;
  transcriptText: string;
  notes: string | null;
};

export const extractReferenceScenarioSystemPrompt = [
  "You analyze short-form video references for Russian UGC script generation.",
  "Return only valid JSON. No markdown, no commentary, no trailing text.",
  "Extract reusable structure, not copyrighted wording or exact scenes.",
].join("\n");

export function buildExtractReferenceScenarioUserPrompt(input: ExtractReferenceScenarioPromptInput) {
  return [
    "Analyze the reference and return JSON with this exact shape:",
    JSON.stringify(
      {
        summary: "...",
        hook: "...",
        formatDNA: "...",
        speakerSetup: "...",
        cameraAndVisualSetup: "...",
        deliveryMechanic: "...",
        productIntegrationPattern: "...",
        scenarioStructure: "...",
        visualPattern: "...",
        editingTempo: "...",
        tone: "...",
        mustPreserve: ["..."],
        whatToBorrow: ["..."],
        whatNotToCopy: ["..."],
        extractedScenarioText: "...",
      },
      null,
      2,
    ),
    "All top-level fields except mustPreserve, whatToBorrow and whatNotToCopy must be plain strings.",
    "mustPreserve, whatToBorrow and whatNotToCopy must be arrays of plain strings.",
    "scenarioStructure must be a compact plain string, not an object or nested JSON.",
    "Write reusable structure in Russian. Do not copy exact wording from the transcript unless needed as a very short label.",
    "formatDNA must name the actual content format: direct-to-camera monologue, dialogue, interview, screen demo with voiceover, street talk, POV scene, sketch, tutorial, etc.",
    "speakerSetup must describe who speaks and to whom: one creator to camera, two-person dialogue, offscreen voiceover, creator + screen, etc.",
    "cameraAndVisualSetup must describe camera relation and visible surface: face to camera, screen recording, hands, product closeups, captions, cuts.",
    "deliveryMechanic must describe how information is delivered: argument, demonstration, proof, list, story, objection handling, casual conversation, etc.",
    "productIntegrationPattern must describe how the advertised product/service should enter if this format is adapted.",
    "mustPreserve must list format-level constraints that should survive adaptation, especially conversation/speaker/camera mechanics.",
    "",
    `Reference type: ${input.type}`,
    `Source: ${input.source || "manual"}`,
    "",
    "Creator notes:",
    input.notes?.trim() || "No notes.",
    "",
    "Transcript/manual text:",
    input.transcriptText,
  ].join("\n");
}
