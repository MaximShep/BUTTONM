import "server-only";

import { mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { referenceAudioPath } from "@/lib/references/paths";

const execFileAsync = promisify(execFile);

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return "ffmpeg недоступен. Загрузите видео вручную, вставьте расшифровку, проверьте ссылку или настройте yt-dlp/ffmpeg.";
  }

  const message = error instanceof Error ? error.message : String(error);
  return `Не удалось извлечь аудио через ffmpeg. Загрузите видео вручную, вставьте расшифровку, проверьте ссылку или настройте yt-dlp/ffmpeg.${message ? ` Детали: ${message}` : ""}`;
}

export async function extractAudioFromVideo(input: {
  projectId: string;
  referenceId: string;
  videoPath: string;
}) {
  const outputPath = referenceAudioPath(input.projectId, input.referenceId, "mp3");
  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input.videoPath, "-vn", "-acodec", "libmp3lame", "-ar", "44100", "-ac", "2", outputPath],
      { maxBuffer: 1024 * 1024 * 20 },
    );
    return outputPath;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}
