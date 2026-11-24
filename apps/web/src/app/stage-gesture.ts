import { useEffect, useRef, type RefObject } from "react";
import type { Presentation } from "./hierarchy";

/** The finger has to have gone this far before it means anything. */
const SLOP = 10;
/** Letting go past this share of the way, or at this speed (px/ms), goes through. */
const COMMIT = 0.38;
const FLING = 0.45;
/** iOS keeps its own back swipe along the edge. */
const EDGE = 24;
const iOS = typeof CSS !== "undefined" && CSS.supports?.("-webkit-touch-callout", "none");

export interface GestureTarget {
  /** The screen a swipe would put away, or null when there is none. */
  top: () => { presentation: Presentation; layer: HTMLElement } | null;
  onMove: (offset: number) => number;
  /** Let go: `away` to leave, with how fast the finger was going in px/ms. */
  onEnd: (away: boolean, velocity: number) => void;
}

const FIELD = "input, textarea, select, [contenteditable], [data-no-swipe], [role='slider']";

/** Whether something between the finger and the layer scrolls sideways itself. */
function scrollsSideways(from: Element, layer: HTMLElement) {
  for (let element: Element | null = from; element && element !== layer; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
  }
  return false;
}

/** Whether something between the finger and the layer still has content above to scroll back to. */
function scrolledDown(from: Element, layer: HTMLElement) {
  for (let element: Element | null = from; element && element !== layer; element = element.parentElement) {
    if (element.scrollTop > 0) return true;
  }
  return false;
}

/** A pushed screen is swiped back to the right; a sheet is pulled down. */
export function useStageGesture(stage: RefObject<HTMLElement | null>, target: GestureTarget) {
  const latest = useRef(target);
  useEffect(() => { latest.current = target; });
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let start: { x: number; y: number; sideways: boolean; on: Element; layer: HTMLElement } | null = null;
    let origin: number | null = null;
    let progress = 0;
    let samples: { at: number; time: number }[] = [];

    const onStart = (event: TouchEvent) => {
      if (origin !== null) return;
      start = null;
      if (event.touches.length !== 1) return;
      const top = latest.current.top();
      const on = event.target as Element;
      if (!top || !top.layer.contains(on) || on.closest(FIELD)) return;
      const { clientX: x, clientY: y } = event.touches[0];
      const sideways = top.presentation === "push";
      if (sideways && iOS && x < EDGE) return;
      start = { x, y, sideways, on, layer: top.layer };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const { clientX, clientY } = event.touches[0];
      const along = start.sideways ? clientX - start.x : clientY - start.y;
      const across = start.sideways ? clientY - start.y : clientX - start.x;
      if (origin === null) {
        if (Math.abs(across) > SLOP && Math.abs(across) >= Math.abs(along)) { start = null; return; }
        if (along < -SLOP) { start = null; return; }
        if (along < SLOP || along < Math.abs(across) * 1.2) return;
        const blocked = start.sideways ? scrollsSideways(start.on, start.layer) : scrolledDown(start.on, start.layer);
        if (blocked || !event.cancelable) { start = null; return; }
        origin = along;
        samples = [];
      }
      if (event.cancelable) event.preventDefault();
      samples.push({ at: along, time: event.timeStamp });
      while (samples.length > 2 && event.timeStamp - samples[0].time > 90) samples.shift();
      progress = latest.current.onMove(along - origin);
    };
    const onEnd = (event: TouchEvent) => {
      const dragging = origin !== null;
      start = null;
      origin = null;
      if (!dragging) return;
      const [first, last] = [samples[0], samples[samples.length - 1]];
      const held = last ? event.timeStamp - last.time > 90 : true;
      const velocity = held || !first ? 0 : (last.at - first.at) / Math.max(1, last.time - first.time);
      const away = event.type !== "touchcancel" && (velocity > FLING || (progress > COMMIT && velocity > -FLING));
      latest.current.onEnd(away, velocity);
    };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [stage]);
}
