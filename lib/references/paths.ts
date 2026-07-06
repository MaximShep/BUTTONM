import "server-only";

import path from "path";

function referenceDataRoot() {
  if (process.env.REFERENCE_DATA_DIR) return process.env.REFERENCE_DATA_DIR;
  if (process.env.NODE_ENV === "production") return "/data/references";

  return path.join(process.cwd(), "data", "references");
}

export function referenceDirectory(projectId: string, referenceId: string) {
  return path.join(referenceDataRoot(), projectId, referenceId);
}

export function referenceVideoPath(projectId: string, referenceId: string) {
  return path.join(referenceDirectory(projectId, referenceId), "video.mp4");
}

export function referenceAudioPath(projectId: string, referenceId: string, extension = "mp3") {
  return path.join(referenceDirectory(projectId, referenceId), `audio.${extension}`);
}
