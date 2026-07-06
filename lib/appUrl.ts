export const defaultAppBaseUrl = "https://ugcbuttonm-huracanovich.amvera.io";

export function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || defaultAppBaseUrl;
}

export function appUrl(path: string, requestUrl?: string | URL) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || requestUrl || defaultAppBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    return new URL(normalizedPath, baseUrl);
  } catch {
    return new URL(normalizedPath, requestUrl ?? defaultAppBaseUrl);
  }
}
