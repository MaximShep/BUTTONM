import "server-only";

import { execFile } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { TranscriptionProvider } from "@/lib/transcription/types";

const execFileAsync = promisify(execFile);

const localSetupMessage =
  "Локальная расшифровка не настроена. Установите зависимости или вставьте расшифровку вручную.";

const minimumModelSizes: Record<string, number> = {
  tiny: 60 * 1024 * 1024,
  base: 120 * 1024 * 1024,
  small: 400 * 1024 * 1024,
  medium: 1_000 * 1024 * 1024,
};

function currentModel() {
  return process.env.LOCAL_WHISPER_MODEL || "small";
}

function huggingFaceModelDirectory(model: string) {
  const cacheRoot = process.env.HF_HOME
    ? path.join(process.env.HF_HOME, "hub")
    : path.join(os.homedir(), ".cache", "huggingface", "hub");
  return path.join(cacheRoot, `models--Systran--faster-whisper-${model}`);
}

function directorySize(directory: string): { bytes: number; hasIncomplete: boolean } {
  let bytes = 0;
  let hasIncomplete = false;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name.endsWith(".incomplete")) hasIncomplete = true;

    if (entry.isDirectory()) {
      const nested = directorySize(entryPath);
      bytes += nested.bytes;
      hasIncomplete ||= nested.hasIncomplete;
    } else if (entry.isFile()) {
      bytes += statSync(entryPath).size;
    }
  }

  return { bytes, hasIncomplete };
}

export function isLocalWhisperModelCached() {
  const model = currentModel();
  const modelDirectory = huggingFaceModelDirectory(model);
  if (!existsSync(modelDirectory)) return false;

  const { bytes, hasIncomplete } = directorySize(modelDirectory);
  const minimumSize = minimumModelSizes[model] ?? 10 * 1024 * 1024;

  return !hasIncomplete && bytes >= minimumSize;
}

export const localWhisperProvider: TranscriptionProvider = {
  name: "local",
  isConfigured: () => true,
  async transcribe(input) {
    const python = process.env.LOCAL_WHISPER_PYTHON || "python3";
    const language = process.env.LOCAL_WHISPER_LANGUAGE || "ru";
    const model = currentModel();
    const scriptPath = path.join(process.cwd(), "scripts", "transcribe_local.py");

    try {
      const { stdout } = await execFileAsync(
        python,
        [scriptPath, "--audio", input.audioPath, "--language", language, "--model", model],
        { maxBuffer: 1024 * 1024 * 100 },
      );
      const parsed = JSON.parse(stdout) as { text?: unknown; error?: unknown };

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        throw new Error(parsed.error);
      }

      const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
      if (!text) {
        throw new Error("Локальная расшифровка вернулась пустой.");
      }

      return { provider: "local", text };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        throw new Error(localSetupMessage);
      }

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("faster-whisper") || message.includes("faster_whisper")) {
        throw new Error(localSetupMessage);
      }

      throw new Error(message || localSetupMessage);
    }
  },
};
