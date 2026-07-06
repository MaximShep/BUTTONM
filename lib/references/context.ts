import "server-only";

import { prisma } from "@/lib/prisma";

const MAX_FIELD_LENGTH = 850;
const MAX_TRANSCRIPT_EXCERPT_LENGTH = 900;
const MAX_REFERENCE_COUNT = 2;

type ScenarioJson = {
  summary?: unknown;
  hook?: unknown;
  formatDNA?: unknown;
  speakerSetup?: unknown;
  cameraAndVisualSetup?: unknown;
  deliveryMechanic?: unknown;
  productIntegrationPattern?: unknown;
  scenarioStructure?: unknown;
  visualPattern?: unknown;
  editingTempo?: unknown;
  tone?: unknown;
  mustPreserve?: unknown;
  whatToBorrow?: unknown;
  whatNotToCopy?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(text: string, maxLength = MAX_FIELD_LENGTH) {
  const compacted = text.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength).trim()}...`;
}

function readList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function transcriptExcerpt(reference: { transcriptText: string | null; notes: string | null }) {
  const source = reference.transcriptText?.trim() || reference.notes?.trim() || "";
  return source ? compactText(source, MAX_TRANSCRIPT_EXCERPT_LENGTH) : "";
}

function parseScenario(text: string) {
  try {
    return JSON.parse(text) as ScenarioJson;
  } catch {
    return { summary: text };
  }
}

export async function buildReferenceContext(projectId: string) {
  const references = await prisma.projectReference.findMany({
    where: {
      projectId,
      useInGeneration: true,
      status: "ready",
      NOT: { extractedScenarioText: null },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_REFERENCE_COUNT,
  });

  const blocks = references
    .map((reference, index) => {
      const parsed = parseScenario(reference.extractedScenarioText ?? "");
      const excerpt = transcriptExcerpt(reference);
      return [
        `Reference ${index + 1}:`,
        "Reference adaptation contract:",
        "- Preserve the format mechanics first: speaker setup, camera relationship, delivery mechanic, pacing, and information flow.",
        "- Adapt the topic/product to the new brief, but do not convert the format into a different genre such as POV/sketch/life scene unless the reference itself uses that genre.",
        "- Do not copy exact transcript wording.",
        readString(parsed.formatDNA) ? `Format DNA: ${compactText(readString(parsed.formatDNA))}` : "",
        readString(parsed.speakerSetup) ? `Speaker setup: ${compactText(readString(parsed.speakerSetup))}` : "",
        readString(parsed.cameraAndVisualSetup) ? `Camera/visual setup: ${compactText(readString(parsed.cameraAndVisualSetup))}` : "",
        readString(parsed.deliveryMechanic) ? `Delivery mechanic: ${compactText(readString(parsed.deliveryMechanic))}` : "",
        readString(parsed.productIntegrationPattern) ? `Product integration pattern: ${compactText(readString(parsed.productIntegrationPattern))}` : "",
        readString(parsed.summary) ? `Summary: ${compactText(readString(parsed.summary))}` : "",
        readString(parsed.hook) ? `Hook type: ${compactText(readString(parsed.hook))}` : "",
        readString(parsed.scenarioStructure) ? `Scenario structure: ${compactText(readString(parsed.scenarioStructure))}` : "",
        readString(parsed.visualPattern) ? `Visual pattern: ${compactText(readString(parsed.visualPattern))}` : "",
        readString(parsed.editingTempo) ? `Editing tempo: ${compactText(readString(parsed.editingTempo))}` : "",
        readString(parsed.tone) ? `Tone: ${compactText(readString(parsed.tone))}` : "",
        readList(parsed.mustPreserve).length ? `Must preserve: ${readList(parsed.mustPreserve).join("; ")}` : "",
        readList(parsed.whatToBorrow).length ? `What to borrow: ${readList(parsed.whatToBorrow).join("; ")}` : "",
        readList(parsed.whatNotToCopy).length ? `What not to copy: ${readList(parsed.whatNotToCopy).join("; ")}` : "",
        excerpt ? `Transcript sample for format detection, not for copying:\n${excerpt}` : "",
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean);

  return blocks.length ? blocks.join("\n\n") : "No processed references are ready for generation.";
}
