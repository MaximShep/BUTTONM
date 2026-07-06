import "server-only";

import { mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { existsSync } from "fs";
import { referenceVideoPath } from "@/lib/references/paths";
import { detectReferenceType, isLinkReferenceType } from "@/lib/references/types";

const execFileAsync = promisify(execFile);

const downloadFallbackMessage =
  "Автоматическое скачивание не сработало. Загрузите видеофайл, вставьте расшифровку вручную, проверьте ссылку или настройте yt-dlp/ffmpeg.";
const instagramFallbackMessage =
  "Instagram может ограничивать скачивание. Загрузите видео вручную, вставьте расшифровку, проверьте ссылку или настройте yt-dlp/ffmpeg.";
const youtubeRateLimitMessage =
  "YouTube временно ограничил скачивание с IP хостинга. Обычно нужно подождать до часа, загрузить видеофайл вручную или подключить cookies для yt-dlp.";

function errorMessage(error: unknown, type: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return `yt-dlp не установлен. ${downloadFallbackMessage}`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("rate-limited") || message.includes("try again later")) {
    return `${youtubeRateLimitMessage}${message ? ` Детали: ${message}` : ""}`;
  }

  if (type === "instagram") {
    return `${instagramFallbackMessage}${message ? ` Детали: ${message}` : ""}`;
  }

  return `${downloadFallbackMessage}${message ? ` Детали: ${message}` : ""}`;
}

async function runYtDlp(args: string[]) {
  const cookieFile = process.env.YT_DLP_COOKIES_FILE;
  const baseArgs = [
    "--no-playlist",
    "--js-runtimes",
    "node",
    "--sleep-requests",
    process.env.YT_DLP_SLEEP_REQUESTS || "3",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    ...(cookieFile && existsSync(cookieFile) ? ["--cookies", cookieFile] : []),
    ...args,
  ];

  try {
    await execFileAsync("yt-dlp", baseArgs, { maxBuffer: 1024 * 1024 * 20 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await execFileAsync(process.env.YT_DLP_PYTHON || process.env.LOCAL_WHISPER_PYTHON || "python3", ["-m", "yt_dlp", ...baseArgs], {
        maxBuffer: 1024 * 1024 * 20,
      });
      return;
    }

    throw error;
  }
}

export async function downloadReferenceVideo(input: {
  projectId: string;
  referenceId: string;
  url: string;
}) {
  const type = detectReferenceType(input.url);
  if (!isLinkReferenceType(type)) {
    throw new Error("Поддерживаются только YouTube, TikTok и Instagram Reels ссылки.");
  }

  const outputPath = referenceVideoPath(input.projectId, input.referenceId);
  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await runYtDlp(["-f", "mp4/best", "-o", outputPath, input.url]);
    return outputPath;
  } catch (error) {
    throw new Error(errorMessage(error, type));
  }
}
