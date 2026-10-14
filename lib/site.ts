const FALLBACK = 'http://localhost:3000';

interface SiteEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

// Origin only (no trailing slash, no path), or null when the value cannot form a URL.
function toOrigin(raw: string | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

// Canonical origin: NEXT_PUBLIC_SITE_URL, else the Vercel production domain (scheme-less there),
// else local dev. Never throws, so a malformed variable cannot break the build.
export function resolveSiteUrl(env: SiteEnv): string {
  return toOrigin(env.NEXT_PUBLIC_SITE_URL) ?? toOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ?? FALLBACK;
}

export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
