import { isOverlay, presentationOf, type Presentation } from "./hierarchy";

/** One screen of the stack. `V` is whatever draws it. */
export interface Entry<V = unknown> {
  /** Its path: a screen is the same screen whatever its query says. */
  key: string;
  search: string;
  /** Its place in the browser's history. */
  idx: number;
  presentation: Presentation;
  view: V;
}

export interface Stack<V = unknown> {
  /** From the bottom to the screen in use. */
  entries: Entry<V>[];
  /** Destinations opened before, kept as they were left. */
  tabs: Entry<V>[];
  /** Screens on their way out, drawn above the rest until they are gone. */
  leaving: Entry<V>[];
  /** The screen on its way in, if one is. */
  entering: string | null;
  /** Goes up whenever the screens have somewhere to move to. */
  turn: number;
  /** The last move happens without animation. */
  instant: boolean;
}

export interface Visit<V = unknown> {
  pathname: string;
  search: string;
  idx: number;
  action: "PUSH" | "REPLACE" | "POP";
  /** A step back towards where the user came from, whatever it did to the history. */
  back: boolean;
  /** The browser has already drawn the move. */
  instant?: boolean;
  view: V;
}

/** Without overlays: what is left when they are all put away. */
function withoutOverlays<V>(entries: Entry<V>[]) {
  let end = entries.length;
  while (end > 0 && isOverlay(entries[end - 1].presentation)) end -= 1;
  return entries.slice(0, end);
}

function entryOf<V>(visit: Visit<V>, bottom: boolean): Entry<V> {
  const presentation = presentationOf(visit.pathname);
  return {
    key: visit.pathname,
    search: visit.search,
    idx: visit.idx,
    // Nothing lies beneath the first screen for a sheet to rise over.
    presentation: bottom && (presentation === "sheet" || presentation === "modal") ? "push" : presentation,
    view: visit.view,
  };
}

const keepTab = <V>(tabs: Entry<V>[], entry: Entry<V> | undefined) =>
  entry?.presentation !== "tab" ? tabs
    : tabs.some((tab) => tab.key === entry.key) ? tabs.map((tab) => (tab.key === entry.key ? entry : tab))
    : [...tabs, entry];

export function firstStack<V>(visit: Visit<V>): Stack<V> {
  const entry = entryOf(visit, true);
  return { entries: [entry], tabs: keepTab([], entry), leaving: [], entering: null, turn: 0, instant: true };
}

/** The stack after a visit, with what moves in and out because of it. */
export function nextStack<V>(stack: Stack<V>, visit: Visit<V>): Stack<V> {
  const { entries } = stack;
  const top = entries[entries.length - 1];
  const at = entries.findIndex((entry) => entry.key === visit.pathname);

  if (at >= 0) {
    // Already in the stack: the same screen, or a step back to one beneath.
    const entry = { ...entries[at], search: visit.search, idx: visit.idx, view: visit.view };
    const next = [...entries.slice(0, at), entry];
    const tabs = keepTab(stack.tabs, entry);
    return at === entries.length - 1 ? { ...stack, entries: next, tabs } : settle(stack, next, tabs, top, null, visit);
  }

  const presentation = presentationOf(visit.pathname);
  if (presentation === "tab") {
    const entry = entryOf(visit, true);
    // A destination swaps in place, unless the screen above it is being left for it.
    const leaves = top.presentation !== "tab" && (isOverlay(top.presentation) || visit.back);
    return settle(stack, [entry], keepTab(stack.tabs, entry), leaves ? top : null, null, visit);
  }

  if (visit.action === "POP" && visit.back) {
    const under = entries.filter((entry) => entry.idx < visit.idx);
    return settle(stack, [...under, entryOf(visit, !under.length)], stack.tabs, top, null, visit);
  }

  if (visit.action === "REPLACE") {
    const overlay = isOverlay(top.presentation) && !isOverlay(presentation);
    const under = overlay ? withoutOverlays(entries) : entries.slice(0, -1);
    return settle(stack, [...under, entryOf(visit, !under.length)], stack.tabs, overlay || visit.back ? top : null, null, visit);
  }

  // Going on to a page from a sheet puts the sheet away and shows the page beneath it.
  if (isOverlay(top.presentation) && presentation === "push") {
    const under = withoutOverlays(entries);
    return settle(stack, [...under, entryOf(visit, !under.length)], stack.tabs, top, null, visit);
  }
  return settle(stack, [...entries, entryOf(visit, false)], stack.tabs, null, visit.pathname, visit);
}

function settle<V>(stack: Stack<V>, entries: Entry<V>[], tabs: Entry<V>[], top: Entry<V> | null, entering: string | null, visit: Visit<V>): Stack<V> {
  // A destination has nowhere to go to: what replaces it is simply there.
  const leaves = top && top.presentation !== "tab" ? top : null;
  const here = new Set(entries.map((entry) => entry.key));
  const instant = Boolean(visit.instant) || (!leaves && !entering);
  const leaving = instant ? [] : [...stack.leaving, ...(leaves ? [leaves] : [])].filter((entry) => !here.has(entry.key));
  return { entries, tabs, leaving, entering, turn: stack.turn + 1, instant };
}

/** Everything that was on its way has arrived. */
export const rested = <V>(stack: Stack<V>): Stack<V> =>
  stack.leaving.length || stack.entering ? { ...stack, leaving: [], entering: null } : stack;
