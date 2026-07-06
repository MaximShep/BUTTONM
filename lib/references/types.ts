import "server-only";

export type ProjectReferenceType = "youtube" | "tiktok" | "instagram" | "uploaded_video" | "manual";

export const projectReferenceTypes = new Set<ProjectReferenceType>([
  "youtube",
  "tiktok",
  "instagram",
  "uploaded_video",
  "manual",
]);

export function isProjectReferenceType(value: string): value is ProjectReferenceType {
  return projectReferenceTypes.has(value as ProjectReferenceType);
}

export function detectReferenceType(url: string): ProjectReferenceType | "unknown" {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase();

    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      return "youtube";
    }

    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") {
      return "tiktok";
    }

    if ((host === "instagram.com" || host.endsWith(".instagram.com")) && (
      pathname.startsWith("/reel/") ||
      pathname.startsWith("/p/") ||
      pathname.startsWith("/tv/")
    )) {
      return "instagram";
    }

    return "unknown";
  } catch {
    return "manual";
  }
}

export function isLinkReferenceType(type: string) {
  return type === "youtube" || type === "tiktok" || type === "instagram";
}
