/**
 * Addresses from before the workspace moved under /app. vercel.json answers
 * them with permanent redirects; the app follows the same table when it is
 * already running (in development, or offline under the service worker).
 */
export const LEGACY_REDIRECTS = [
  { source: "/", destination: "/app", permanent: true },
  { source: "/about", destination: "/app", permanent: true },
  { source: "/settings", destination: "/app/me", permanent: true },
  {
    source: "/questions/new",
    destination: "/app/questions/generate",
    permanent: true,
  },
  {
    source: "/questions/reading/new",
    destination: "/app/questions/generate",
    permanent: true,
  },
  ...["library", "progress", "me", "practice", "sets", "questions", "sync"].map(
    (segment) => ({
      source: `/${segment}/:path*`,
      destination: `/app/${segment}/:path*`,
      permanent: true,
    }),
  ),
] as const;

const REST = "/:path*";

/** Where an old pathname now lives, or null when it is not an old address. */
export function legacyDestination(pathname: string): string | null {
  for (const { source, destination } of LEGACY_REDIRECTS) {
    if (!source.endsWith(REST)) {
      if (pathname === source) return destination;
      continue;
    }
    const base = source.slice(0, -REST.length);
    if (pathname !== base && !pathname.startsWith(`${base}/`)) continue;
    return destination.slice(0, -REST.length) + pathname.slice(base.length);
  }
  return null;
}
