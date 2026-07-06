import "server-only";

import { mkdir } from "fs/promises";
import path from "path";
import { generateText } from "@/lib/llm/gateway";
import {
  buildExtractReferenceScenarioUserPrompt,
  extractReferenceScenarioSystemPrompt,
} from "@/lib/prompts/extractReferenceScenarioPrompt";
import { prisma } from "@/lib/prisma";
import { downloadReferenceVideo } from "@/lib/references/downloadReference";
import { extractAudioFromVideo } from "@/lib/references/extractAudio";
import { referenceDirectory } from "@/lib/references/paths";
import { isLinkReferenceType } from "@/lib/references/types";
import { isLocalWhisperModelCached } from "@/lib/transcription/providers/localWhisper";
import { transcribeAudio } from "@/lib/transcription/transcriptionGateway";
import { referenceErrorMessage } from "@/lib/userMessages";

type ExtractedScenario = {
  summary: string;
  hook: string;
  formatDNA: string;
  speakerSetup: string;
  cameraAndVisualSetup: string;
  deliveryMechanic: string;
  productIntegrationPattern: string;
  scenarioStructure: string;
  visualPattern: string;
  editingTempo: string;
  tone: string;
  mustPreserve: string[];
  whatToBorrow: string[];
  whatNotToCopy: string[];
  extractedScenarioText: string;
};

const manualInputMessage =
  "Вставьте расшифровку вручную и нажмите «Обработать». Также можно загрузить видео вручную, проверить ссылку или настроить yt-dlp/ffmpeg.";

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("LLM не вернул JSON со структурой референса.");
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textField(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function parseExtractedScenario(text: string): ExtractedScenario {
  const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
  const result = {
    summary: stringField(parsed.summary),
    hook: stringField(parsed.hook),
    formatDNA: stringField(parsed.formatDNA),
    speakerSetup: stringField(parsed.speakerSetup),
    cameraAndVisualSetup: stringField(parsed.cameraAndVisualSetup),
    deliveryMechanic: stringField(parsed.deliveryMechanic),
    productIntegrationPattern: stringField(parsed.productIntegrationPattern),
    scenarioStructure: textField(parsed.scenarioStructure),
    visualPattern: textField(parsed.visualPattern),
    editingTempo: textField(parsed.editingTempo),
    tone: textField(parsed.tone),
    mustPreserve: stringArray(parsed.mustPreserve),
    whatToBorrow: stringArray(parsed.whatToBorrow),
    whatNotToCopy: stringArray(parsed.whatNotToCopy),
    extractedScenarioText: textField(parsed.extractedScenarioText),
  };

  if (!result.summary || !result.scenarioStructure || !result.extractedScenarioText) {
    throw new Error("LLM вернул неполную структуру референса.");
  }

  return result;
}

function sourceLabel(reference: { url: string | null; fileName: string | null; localFilePath: string | null }) {
  return reference.url || reference.fileName || (reference.localFilePath ? path.basename(reference.localFilePath) : null);
}

async function setStatus(referenceId: string, status: string, data: Record<string, unknown> = {}) {
  await prisma.projectReference.update({
    where: { id: referenceId },
    data: { status, error: null, ...data },
  });
}

async function extractScenario(input: {
  projectId: string;
  referenceId: string;
  type: string;
  source: string | null;
  transcriptText: string;
  notes: string | null;
}) {
  const result = await generateText({
    task: "extract_reference_scenario",
    projectId: input.projectId,
    systemPrompt: extractReferenceScenarioSystemPrompt,
    userPrompt: buildExtractReferenceScenarioUserPrompt(input),
    temperature: 0.2,
    maxTokens: 1800,
  });

  return parseExtractedScenario(result.text);
}

export async function processReference(referenceId: string) {
  const reference = await prisma.projectReference.findUnique({
    where: { id: referenceId },
    include: { project: { select: { id: true } } },
  });

  if (!reference) {
    throw new Error("Reference not found.");
  }

  try {
    await setStatus(reference.id, "processing");

    let transcriptText = reference.transcriptText?.trim() || "";
    let videoPath = reference.localFilePath;

    if (isLinkReferenceType(reference.type) && !transcriptText) {
      if (!reference.url) throw new Error("Для ссылки не указан URL.");
      await setStatus(reference.id, "downloading");
      videoPath = await downloadReferenceVideo({
        projectId: reference.projectId,
        referenceId: reference.id,
        url: reference.url,
      });
      await prisma.projectReference.update({
        where: { id: reference.id },
        data: { localFilePath: videoPath },
      });
    }

    if (reference.type === "uploaded_video" || isLinkReferenceType(reference.type)) {
      if (!transcriptText) {
        if (!videoPath) throw new Error(`Видео не найдено. ${manualInputMessage}`);
        await setStatus(reference.id, "extracting_audio");
        const audioPath = await extractAudioFromVideo({
          projectId: reference.projectId,
          referenceId: reference.id,
          videoPath,
        });
        await mkdir(referenceDirectory(reference.projectId, reference.id), { recursive: true });
        if ((process.env.TRANSCRIPTION_PROVIDER || "mock") === "local" && !isLocalWhisperModelCached()) {
          await setStatus(reference.id, "downloading_model");
        } else {
          await setStatus(reference.id, "transcribing");
        }
        const transcription = await transcribeAudio({
          audioPath,
          outputDir: referenceDirectory(reference.projectId, reference.id),
        }).catch((error) => {
          const detail = error instanceof Error ? error.message : "";
          throw new Error(
            `Не удалось расшифровать автоматически. Можно вставить расшифровку вручную и снова нажать «Обработать». Также можно загрузить видео вручную, проверить ссылку или настроить yt-dlp/ffmpeg.${detail ? ` Детали: ${detail}` : ""}`,
          );
        });
        transcriptText = transcription.text;
        await prisma.projectReference.update({
          where: { id: reference.id },
          data: { transcriptText },
        });
      }
    }

    if (!transcriptText && !reference.notes?.trim()) {
      throw new Error(`Нет текста для обработки. ${manualInputMessage}`);
    }

    await setStatus(reference.id, "extracting_scenario");
    const extracted = await extractScenario({
      projectId: reference.projectId,
      referenceId: reference.id,
      type: reference.type,
      source: sourceLabel(reference),
      transcriptText: transcriptText || reference.notes || "",
      notes: reference.notes,
    });

    await prisma.projectReference.update({
      where: { id: reference.id },
      data: {
        status: "ready",
        error: null,
        transcriptText: transcriptText || reference.transcriptText,
        extractedScenarioText: JSON.stringify(extracted, null, 2),
      },
    });

    await prisma.projectEvent.create({
      data: {
        projectId: reference.projectId,
        type: "reference.processed",
        payloadJson: JSON.stringify({ referenceId: reference.id, type: reference.type }),
      },
    });

    return extracted;
  } catch (error) {
    const message = referenceErrorMessage(error);
    await prisma.projectReference.update({
      where: { id: reference.id },
      data: { status: "failed", error: message },
    });
    return null;
  }
}
