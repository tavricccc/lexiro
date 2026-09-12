interface ClientRouter {
  back(): void;
  push(href: string): void;
}

let currentPath = "";
let previousPath = "";
let pendingRouteDirection: RouteDirection | null = null;
let currentHistoryIndex: number | null = null;
let pendingHistoryIndex: number | null = null;
const HISTORY_INDEX_KEY = "__lexiroHistoryIndex";

export type RouteDirection = "back" | "child" | "root";

/**
 * The places primary navigation points at, in the order it shows them.
 *
 * Everything else the shell renders sits beneath one of these, so this one
 * table answers every question about a route the shell has to ask: which
 * destination a page belongs to, whether it reveals in place, and whether the
 * floating bar belongs on it. The shell supplies the label and the icon for
 * each entry and nothing else.
 */
export const PRIMARY_DESTINATIONS = [
  // 今天 opens both kinds of practice with a count beside each, so 練習 is a
  // screen you arrive at rather than a place you go: it keeps its route for
  // every link that starts a session, but not a slot of its own.
  { activePathPrefix: "/practice", href: "/" },
  { href: "/library" },
  { href: "/progress" },
  { href: "/me" },
] as const satisfies ReadonlyArray<{
  activePathPrefix?: string;
  href: string;
}>;

export type PrimaryDestination = (typeof PRIMARY_DESTINATIONS)[number]["href"];

/** A destination primary navigation points at. */
export function isRootRoute(pathname: string) {
  return PRIMARY_DESTINATIONS.some(
    (destination) => destination.href === pathname,
  );
}

// The library owns the set routes and the study screen owns practice even
// though their URLs do not say so, so the one place that knows it is here: the
// direction a navigation animates in is read from this table.
const ADOPTED_PARENTS: ReadonlyArray<
  readonly [prefix: string, parent: string]
> = [
  ["/practice", "/"],
  ["/sets", "/library"],
  ["/questions", "/library"],
  ["/sync", "/me"],
];

export function adoptedParent(pathname: string) {
  for (const [prefix, parent] of ADOPTED_PARENTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return parent;
  }
  return null;
}

function hierarchy(pathname: string): string[] {
  const parent = adoptedParent(pathname);
  const segments = pathname === "/" ? ["home"] : pathname.split("/").filter(Boolean);
  return parent && parent !== pathname
    ? [...hierarchy(parent), ...segments]
    : segments;
}

/**
 * How `to` sits relative to `from` in the information hierarchy, for a
 * navigation nobody marked a direction on. Depth decides it: a page with more
 * ancestors than the one it replaced is a push, one with fewer is a pop, and
 * one with the same number is a replacement, which is what "root" means here.
 *
 * Depth on its own, not depth along a shared branch. A set belongs to the
 * Library wherever it was opened from, so requiring a shared branch made the
 * first set opened from 今天 a replacement with no animation, and the same set
 * opened again after a back — from the Library this time — a push. One tap,
 * two behaviours, decided by where the session happened to start.
 *
 * Without this, every back control would have to remember to mark itself, and
 * the one that forgot would send the user backwards on the forward animation.
 */
function inferRouteDirection(from: string, to: string): RouteDirection {
  if (!from || from === to) return isRootRoute(to) ? "root" : "child";
  const before = hierarchy(from).length;
  const after = hierarchy(to).length;
  if (after > before) return "child";
  if (before > after) return "back";
  return "root";
}

export function markRouteDirection(direction: RouteDirection) {
  pendingRouteDirection = direction;
}

export function consumeRouteDirection(pathname: string) {
  return pendingRouteDirection ?? inferRouteDirection(currentPath, pathname);
}

export function rememberRoutePath(pathname: string) {
  if (!pathname || pathname === currentPath) return;
  previousPath = currentPath;
  currentPath = pathname;
}

function readHistoryIndex(state: unknown) {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[HISTORY_INDEX_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stampHistoryIndex(index: number) {
  window.history.replaceState(
    { ...window.history.state, [HISTORY_INDEX_KEY]: index },
    "",
  );
}

export function commitRouteHistory(pathname: string) {
  if (typeof window === "undefined") {
    rememberRoutePath(pathname);
    return;
  }
  const stampedIndex = readHistoryIndex(window.history.state);
  if (currentHistoryIndex === null) {
    currentHistoryIndex = stampedIndex ?? 0;
    if (stampedIndex === null) stampHistoryIndex(currentHistoryIndex);
  } else if (pendingHistoryIndex !== null) {
    currentHistoryIndex = pendingHistoryIndex;
    pendingHistoryIndex = null;
  } else if (pathname !== currentPath) {
    currentHistoryIndex += 1;
    stampHistoryIndex(currentHistoryIndex);
  }
  rememberRoutePath(pathname);
  // A route can render more than once while its loading boundary resolves.
  // Keep the intended direction through those renders, then retire it only
  // once the destination pathname is committed.
  pendingRouteDirection = null;
}

export function markPopstateRouteDirection(state: unknown, pathname: string) {
  const targetIndex = readHistoryIndex(state);
  if (targetIndex === null || currentHistoryIndex === null) {
    // Without our stamp this is still a browser history traversal, so retain
    // the return motion instead of treating a detail pathname as a new child.
    markRouteDirection("back");
    return;
  }
  pendingHistoryIndex = targetIndex;
  markRouteDirection(
    targetIndex < currentHistoryIndex
      ? "back"
      : isRootRoute(pathname)
        ? "root"
        : "child",
  );
}

export function returnToPreviousRoute(
  router: ClientRouter,
  fallback: string,
  expectedPrefix: string,
) {
  if (
    previousPath === expectedPrefix ||
    previousPath.startsWith(`${expectedPrefix}/`) ||
    previousPath.startsWith(`${expectedPrefix}?`)
  ) {
    markRouteDirection("back");
    router.back();
    return;
  }
  markRouteDirection("back");
  router.push(fallback);
}

export function returnToPreviousInAppRoute(
  router: ClientRouter,
  fallback: string,
) {
  if (previousPath && previousPath !== currentPath) {
    markRouteDirection("back");
    router.back();
    return;
  }
  markRouteDirection("back");
  router.push(fallback);
}
