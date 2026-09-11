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

function isRootRoute(pathname: string) {
  return ["/", "/library", "/practice", "/progress", "/me"].includes(pathname);
}

// The library owns the set routes and the study screen owns practice even
// though their URLs do not say so, so the one place that knows it is here: the
// direction a navigation animates in is read from this table.
const ADOPTED_PARENTS: ReadonlyArray<
  readonly [prefix: string, parent: string]
> = [
  ["/sets", "/library"],
  ["/questions", "/"],
];

function adoptedParent(pathname: string) {
  for (const [prefix, parent] of ADOPTED_PARENTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return parent;
  }
  return null;
}

function hierarchy(pathname: string): string[] {
  const parent = adoptedParent(pathname);
  const segments = pathname.split("/").filter(Boolean);
  return parent && parent !== pathname
    ? [...hierarchy(parent), ...segments]
    : segments;
}

/**
 * How `to` sits relative to `from` in the information hierarchy, for a
 * navigation nobody marked a direction on. Only a move along one branch is a
 * push or a pop; switching branches, or swapping one sibling for another, is a
 * replacement, which is what "root" means here.
 *
 * Without this, every back control would have to remember to mark itself, and
 * the one that forgot would send the user backwards on the forward animation.
 */
function inferRouteDirection(from: string, to: string): RouteDirection {
  if (!from || from === to) return isRootRoute(to) ? "root" : "child";
  const before = hierarchy(from);
  const after = hierarchy(to);
  const shared = Math.min(before.length, after.length);
  for (let index = 0; index < shared; index += 1) {
    if (before[index] !== after[index]) return "root";
  }
  if (after.length > before.length) return "child";
  if (before.length > after.length) return "back";
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
