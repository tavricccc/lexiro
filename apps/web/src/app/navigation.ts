import type { DataRouter } from "react-router";
import type { Navigation } from "design-kit";

/** What the last change of location was, beyond what the router says about it. */
export interface Trip {
  /** The location it led to. */
  key: string;
  back: boolean;
  /** The browser drew the move itself (an iOS edge swipe); doing it again would play it twice. */
  drawn: boolean;
}
export let lastTrip: Trip = { key: "", back: false, drawn: false };

/** Where the screens in use sit in the browser's history, from the bottom up; the stage keeps it. */
let places: { path: string; idx: number }[] = [];
export const setPlaces = (next: typeof places) => { places = next; };

/** A press on the destination already showing. */
export const TO_TOP = "lexiro:to-top";

export const historyIndex = (): number => (window.history.state as { idx?: number } | null)?.idx ?? 0;

let goingBack = false;
let drawnByBrowser = false;
const iOS = typeof CSS !== "undefined" && CSS.supports?.("-webkit-touch-callout", "none");

if (typeof window !== "undefined") {
  // Registered before the router's own listener, so it has the answer first.
  window.addEventListener("popstate", (event) => {
    // Older iOS cannot say; there a step the app did not take is the edge swipe.
    drawnByBrowser = event.hasUAVisualTransition ?? (iOS && !goingBack);
  });
}

/** The kit's navigation over React Router, following the stack of screens. */
export function routerNavigation(router: DataRouter): Navigation {
  let at = historyIndex();
  let key = router.state.location.key;
  router.subscribe((state) => {
    if (state.location.key === key) return;
    key = state.location.key;
    const now = historyIndex();
    const pop = state.historyAction === "POP";
    lastTrip = { key, back: goingBack || (pop && now < at), drawn: pop && !goingBack && drawnByBrowser };
    at = now;
    goingBack = false;
    drawnByBrowser = false;
  });

  const goTo = (place: (typeof places)[number], path: string) => {
    goingBack = true;
    const steps = place.idx - historyIndex();
    if (steps < 0) void router.navigate(steps);
    else void router.navigate(path, { replace: true });
  };
  const find = (path: string) => places.slice(0, -1).findLast((place) => place.path === path);

  return {
    href: (path) => path,
    navigate: (path, options) => {
      if (!path.startsWith("/")) return false;
      if (path === router.state.location.pathname && path === places[0]?.path) {
        window.dispatchEvent(new Event(TO_TOP));
        return true;
      }
      // A link to a screen beneath this one unwinds to it.
      const beneath = find(path);
      if (beneath) goTo(beneath, path);
      else void router.navigate(path, { replace: options?.replace });
      return true;
    },
    back: (parent) => {
      const beneath = places.at(-2);
      if (beneath) return goTo(beneath, parent);
      goingBack = true;
      void router.navigate(parent, { replace: true });
    },
    popTo: (path) => {
      const beneath = find(path);
      if (beneath) return goTo(beneath, path);
      goingBack = true;
      void router.navigate(path, { replace: true });
    },
  };
}
