import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import type { TranscriptionProvider } from "@/lib/transcription/types";

export const openaiWhisperProvider: TranscriptionProvider = {
  name: "openai",
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
  async transcribe(input) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY не задан.");
    }

    const formData = new FormData();
    const audio = await readFile(input.audioPath);
    formData.append("model", "whisper-1");
    formData.append("file", new Blob([new Uint8Array(audio)]), path.basename(input.audioPath));

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const body = await response.json().catch(() => null) as { text?: string; error?: { message?: string } } | null;

    if (!response.ok) {
      throw new Error(body?.error?.message ?? "OpenAI transcription API вернул ошибку.");
    }

    return {
      provider: "openai",
      text: body?.text?.trim() || "",
    };
  },
};
