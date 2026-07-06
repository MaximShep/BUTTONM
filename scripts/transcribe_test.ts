import { execFile } from "child_process";
import { existsSync, mkdtempSync } from "fs";
import { readdir } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm"]);

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts);
}

async function findTestAsset() {
  const explicit = process.argv[2];
  if (explicit) return path.resolve(explicit);

  const directory = repoPath("test-assets");
  if (!existsSync(directory)) {
    throw new Error("Передайте путь к audio/video файлу: npm run transcribe:test -- ./path/to/file.mp4");
  }

  const files = await readdir(directory);
  const candidate = files.find((file) => audioExtensions.has(path.extname(file)) || videoExtensions.has(path.extname(file)));
  if (!candidate) {
    throw new Error("В test-assets нет audio/video файла. Передайте путь аргументом.");
  }

  return path.join(directory, candidate);
}

async function checkCommand(command: string, args: string[]) {
  try {
    await execFileAsync(command, args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} не запускается: ${message}`);
  }
}

async function prepareAudio(inputPath: string) {
  const extension = path.extname(inputPath).toLowerCase();
  if (audioExtensions.has(extension)) return inputPath;

  if (!videoExtensions.has(extension)) {
    throw new Error("Файл должен быть audio или video.");
  }

  const outputDir = mkdtempSync(path.join(os.tmpdir(), "transcribe-test-"));
  const outputPath = path.join(outputDir, "audio.mp3");
  await execFileAsync("ffmpeg", ["-y", "-i", inputPath, "-vn", "-acodec", "libmp3lame", outputPath], {
    maxBuffer: 1024 * 1024 * 20,
  });
  return outputPath;
}

async function main() {
  const python = process.env.LOCAL_WHISPER_PYTHON || "python3";
  const model = process.env.LOCAL_WHISPER_MODEL || "small";
  const language = process.env.LOCAL_WHISPER_LANGUAGE || "ru";
  const inputPath = await findTestAsset();

  if (!existsSync(inputPath)) {
    throw new Error(`Файл не найден: ${inputPath}`);
  }

  await checkCommand("ffmpeg", ["-version"]);
  await checkCommand(python, ["--version"]);

  const audioPath = await prepareAudio(inputPath);
  const scriptPath = repoPath("scripts", "transcribe_local.py");
  const { stdout } = await execFileAsync(
    python,
    [scriptPath, "--audio", audioPath, "--language", language, "--model", model],
    { maxBuffer: 1024 * 1024 * 20 },
  );

  const parsed = JSON.parse(stdout) as { text?: string; error?: string };
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.text?.trim()) throw new Error("JSON вернулся без text.");

  console.log(JSON.stringify({ ok: true, textPreview: parsed.text.slice(0, 240) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
