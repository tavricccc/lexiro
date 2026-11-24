/**
 * How a screen arrives, as on iOS:
 * - `tab`: one of the five destinations; they swap without moving and carry the dock.
 * - `push`: slides in from the right over the screen before it, dock included.
 * - `sheet`: rises as far as its content needs, over a dimmed screen.
 * - `modal`: a task of its own, rising to almost the whole screen.
 * - `full`: takes the whole screen, rail included, until it is closed.
 */
export type Presentation = "tab" | "push" | "sheet" | "modal" | "full";

export const TABS = ["/app", "/app/library", "/app/progress", "/app/rooms", "/app/me"] as const;

const RULES: [RegExp, Presentation][] = [
  [/^\/app\/practice\/run$/, "full"],
  [/^\/app\/rooms\/[^/]+$/, "full"],
  [/^\/app\/sets\/[^/]+\/cards$/, "full"],
  [/^\/app\/sets\/new$/, "modal"],
  [/^\/app\/sets\/[^/]+\/(settings|add)$/, "modal"],
  [/^\/app\/sets\/[^/]+\/words\/[^/]+\/edit$/, "modal"],
  [/^\/app\/library\/shared\/[^/]+$/, "modal"],
  [/^\/app\/sets\/[^/]+\/words\/[^/]+$/, "sheet"],
];

export function presentationOf(pathname: string): Presentation {
  if ((TABS as readonly string[]).includes(pathname)) return "tab";
  return RULES.find(([path]) => path.test(pathname))?.[1] ?? "push";
}

/** The destination a path belongs to, for a screen opened with nothing beneath it. */
export function tabOf(pathname: string): string | null {
  if (/^\/app\/(sets|library|starred)(\/|$)/.test(pathname)) return "/app/library";
  if (pathname === "/app" || pathname.startsWith("/app/practice")) return "/app";
  return TABS.find((tab) => tab !== "/app" && (pathname === tab || pathname.startsWith(`${tab}/`))) ?? null;
}

/** A screen that lies over the one before it instead of taking its place. */
export const isOverlay = (presentation: Presentation) => presentation === "sheet" || presentation === "modal" || presentation === "full";
/** A screen nothing beneath shows through. */
export const isOpaque = (presentation: Presentation) => presentation !== "sheet" && presentation !== "modal";
