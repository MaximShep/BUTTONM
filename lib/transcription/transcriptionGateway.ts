import "server-only";

import { mockTranscriptionProvider } from "@/lib/transcription/providers/mock";
import { openaiWhisperProvider } from "@/lib/transcription/providers/openaiWhisper";
import { localWhisperProvider } from "@/lib/transcription/providers/localWhisper";
import type { TranscriptionProvider, TranscriptionProviderName, TranscriptionRequest } from "@/lib/transcription/types";

const providers: Record<TranscriptionProviderName, TranscriptionProvider> = {
  mock: mockTranscriptionProvider,
  openai: openaiWhisperProvider,
  local: localWhisperProvider,
};

function providerName(value: string | undefined): TranscriptionProviderName {
  if (value === "openai" || value === "local" || value === "mock") return value;
  if (value === "openaiWhisper") return "openai";
  if (value === "localWhisper") return "local";
  return "mock";
}

export async function transcribeAudio(input: TranscriptionRequest) {
  const selectedProvider = providers[providerName(process.env.TRANSCRIPTION_PROVIDER)];

  if (!selectedProvider.isConfigured()) {
    throw new Error("Реальная расшифровка не настроена. Вставьте transcriptText вручную и обработайте референс.");
  }

  const result = await selectedProvider.transcribe(input);

  if (!result.text.trim()) {
    throw new Error("Расшифровка вернулась пустой. Вставьте transcriptText вручную и обработайте референс.");
  }

  return result;
}
