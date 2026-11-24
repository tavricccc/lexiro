import { cssEasing, timingMs, type MotionCurve, type MotionRung } from "design-kit";
import { isOpaque, type Presentation } from "./hierarchy";
import type { Entry, Stack } from "./stack";

/** The destinations share one layer, so the dock stays put while they swap. */
export const TAB_LAYER = "tabs";
export const layerKey = (entry: Entry) => (entry.presentation === "tab" ? TAB_LAYER : entry.key);

interface Pose {
  x: string;
  y: string;
  scale: number;
  opacity: number;
  /** How far the screen is darkened by the one over it. */
  dim: number;
  /** How far a sheet's scrim has come in. */
  scrim: number;
}
const REST: Pose = { x: "0px", y: "0px", scale: 1, opacity: 1, dim: 0, scrim: 1 };

export interface Viewing { compact: boolean; still: boolean }

/** Where a screen waits before it arrives, and goes when it leaves. */
function away(presentation: Presentation, { compact, still }: Viewing): Pose {
  if (still) return { ...REST, opacity: 0, scrim: 0 };
  if (presentation === "push" || presentation === "tab") return { ...REST, x: "100%", scrim: 0 };
  if (presentation === "full" || compact) return { ...REST, y: "100%", scrim: 0 };
  return { ...REST, y: "12px", scale: 0.97, opacity: 0, scrim: 0 };
}

/** Where a screen lies while another is over it. */
function under(over: Presentation, { compact, still }: Viewing): Pose {
  if (still) return REST;
  if (over === "push") return { ...REST, x: "-30%", dim: 1 };
  if (over === "full") return { ...REST, dim: 1 };
  if (over === "modal" && compact) return { ...REST, y: "var(--stage-recede)", scale: 0.92 };
  return REST;
}

const transformOf = (pose: Pose) => `translate3d(${pose.x}, ${pose.y}, 0px) scale(${pose.scale})`;

export interface Pace { ms: number; curve: MotionCurve }
const pace = (rung: MotionRung, curve: MotionCurve): Pace => ({ ms: timingMs(rung), curve });

function paceOf(presentation: Presentation, leaving: boolean, { compact, still }: Viewing): Pace {
  if (still) return pace("control", "move");
  if (presentation === "push" || presentation === "tab") return pace("push", "nav");
  if (compact || presentation === "full") return leaving ? pace("sheetExit", "nav") : pace("sheet", "nav");
  return leaving ? pace("controlExit", "depart") : pace("nav", "nav");
}

const part = (layer: HTMLElement, name: string) => layer.querySelector<HTMLElement>(`:scope > .screen-surface > .screen-${name}, :scope > .screen-${name}`);

function drive(element: HTMLElement | null, from: Keyframe | null, to: Record<string, string>, pace: Pace | null): Animation | null {
  if (!element) return null;
  const start = from ?? (() => {
    const style = getComputedStyle(element);
    return Object.fromEntries(Object.keys(to).map((name) => [name, style[name as "opacity"]]));
  })();
  for (const animation of element.getAnimations?.() ?? []) if (animation.id === "stage") animation.cancel();
  Object.assign(element.style, to);
  if (!pace || !element.animate) return null;
  const animation = element.animate([start, to], { duration: pace.ms, easing: cssEasing(pace.curve) });
  animation.id = "stage";
  return animation;
}

/** Moves a layer to `to`, from `from` or from wherever it is now. */
function move(layer: HTMLElement, from: Pose | null, to: Pose, pace: Pace | null) {
  return [
    drive(part(layer, "surface"), from && { transform: transformOf(from), opacity: String(from.opacity) }, { transform: transformOf(to), opacity: String(to.opacity) }, pace),
    drive(part(layer, "dim"), from && { opacity: String(from.dim) }, { opacity: String(to.dim) }, pace),
    drive(part(layer, "scrim"), from && { opacity: String(from.scrim) }, { opacity: String(to.scrim) }, pace),
  ].filter((animation): animation is Animation => animation !== null);
}

/** A screen at rest keeps no transform, so its text stays sharp and it holds no compositor layer. */
function relax(layer: HTMLElement, pose: Pose) {
  if (pose !== REST) return;
  const surface = part(layer, "surface");
  if (surface) surface.style.transform = "";
}

/** The layers that show, from `from` down through the first one nothing shows through. */
function showing(entries: Entry[], from: number, into: Set<string>) {
  for (let i = from; i >= 0; i -= 1) {
    into.add(layerKey(entries[i]));
    if (isOpaque(entries[i].presentation)) return;
  }
}

const isRecessed = (entries: Entry[], at: number, { compact, still }: Viewing) => compact && !still && entries[at + 1]?.presentation === "modal";

/**
 * Puts every layer of the stack where it belongs, animated or at once. A layer
 * that is already moving carries on from where it is.
 */
export function arrange(layers: Map<string, HTMLElement>, stack: Stack, shown: Set<string>, viewing: Viewing, override?: Pace): Animation[] {
  const { entries, leaving, entering } = stack;
  const last = entries.length - 1;
  const mover = leaving.at(-1) ?? (entering ? entries[last] : null);
  const paced = stack.instant || !mover ? null : override ?? paceOf(mover.presentation, Boolean(leaving.length), viewing);
  const visible = new Set<string>();
  showing(entries, last, visible);
  if (paced && entering) showing(entries, last - 1, visible);
  for (const entry of leaving) visible.add(layerKey(entry));

  const animations: Animation[] = [];
  const stage = layers.values().next().value?.parentElement;
  if (stage && (entries.some((_, i) => isRecessed(entries, i, viewing)) || (paced && leaving.some((entry) => entry.presentation === "modal") && viewing.compact && !viewing.still))) stage.dataset.recessed = "";

  entries.forEach((entry, i) => {
    const key = layerKey(entry);
    const layer = layers.get(key);
    if (!layer) return;
    const over = entries[i + 1];
    const target = over ? under(over.presentation, viewing) : REST;
    const show = visible.has(key);
    layer.dataset.shown = show ? "true" : "false";
    if (isRecessed(entries, i, viewing)) layer.dataset.recessed = "";
    else delete layer.dataset.recessed;
    const wasShown = shown.has(key);
    const from = wasShown || !mover ? null
      : key === entering ? away(entry.presentation, viewing)
      : leaving.length ? under(mover.presentation, viewing)
      : null;
    animations.push(...move(layer, from ?? (wasShown ? null : target), target, show && (wasShown || from) ? paced : null));
  });
  for (const entry of leaving) {
    const layer = layers.get(layerKey(entry));
    if (!layer) continue;
    layer.dataset.shown = "true";
    animations.push(...move(layer, null, away(entry.presentation, viewing), paced));
  }
  for (const [key, layer] of layers) {
    const inUse = entries.some((entry) => layerKey(entry) === key) || leaving.some((entry) => layerKey(entry) === key);
    if (!inUse) layer.dataset.shown = "false";
  }
  shown.clear();
  for (const key of visible) shown.add(key);
  return animations;
}

/** Once everything has arrived: only what shows is drawn, and at rest. */
export function rest(layers: Map<string, HTMLElement>, stack: Stack, shown: Set<string>, viewing: Viewing) {
  const { entries } = stack;
  const visible = new Set<string>();
  showing(entries, entries.length - 1, visible);
  entries.forEach((entry, i) => {
    const key = layerKey(entry);
    const layer = layers.get(key);
    if (!layer) return;
    layer.dataset.shown = visible.has(key) ? "true" : "false";
    relax(layer, entries[i + 1] ? under(entries[i + 1].presentation, viewing) : REST);
  });
  const stage = layers.values().next().value?.parentElement;
  if (stage && !entries.some((_, i) => isRecessed(entries, i, viewing))) delete stage.dataset.recessed;
  shown.clear();
  for (const key of visible) shown.add(key);
}

/** Follows a finger: the top screen `offset` px along its way out, the one beneath coming back with it. */
export function follow(top: HTMLElement, beneath: HTMLElement | undefined, presentation: Presentation, offset: number, viewing: Viewing) {
  const surface = part(top, "surface");
  if (!surface) return 0;
  const sideways = presentation === "push";
  const size = (sideways ? surface.offsetWidth : surface.offsetHeight) || 1;
  const progress = Math.min(1, Math.max(0, offset / size));
  const at = (pose: Pose, share: number): Pose => ({
    x: `calc(${pose.x} * ${share})`,
    y: `calc(${pose.y} * ${share})`,
    scale: 1 + (pose.scale - 1) * share,
    opacity: 1,
    dim: pose.dim * share,
    scrim: 1,
  });
  for (const animation of [top, beneath].flatMap((layer) => layer?.getAnimations?.({ subtree: true }) ?? [])) if (animation.id === "stage") animation.cancel();
  move(top, null, { ...REST, [sideways ? "x" : "y"]: `${Math.max(0, offset)}px`, scrim: 1 - progress }, null);
  if (beneath) {
    beneath.dataset.shown = "true";
    move(beneath, null, at(under(presentation, viewing), 1 - progress), null);
  }
  return progress;
}
