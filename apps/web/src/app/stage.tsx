import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { UNSAFE_LocationContext as LocationContext, useLocation, useNavigationType, useOutlet, type Location } from "react-router";
import { useCompactViewport, useNavigation } from "design-kit";
import { ScreenContext, ScreenScroller } from "@/ui/screen";
import { isOverlay, tabOf } from "./hierarchy";
import { TO_TOP, historyIndex, lastTrip, setPlaces } from "./navigation";
import { firstStack, nextStack, rested, type Entry, type Stack, type Visit } from "./stack";
import { useStageGesture } from "./stage-gesture";
import { TAB_LAYER, arrange, follow, layerKey, rest, type Pace } from "./stage-motion";

/** What draws a screen, held as it was when the screen was last in use. */
interface View { outlet: React.ReactNode; location: Location }

const REDUCED = "(prefers-reduced-motion: reduce)";
const useStill = () => useSyncExternalStore(
  (changed) => {
    const query = window.matchMedia(REDUCED);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  },
  () => window.matchMedia(REDUCED).matches,
);

/** The stack of screens, following the router. */
function useStack() {
  const outlet = useOutlet();
  const location = useLocation();
  const action = useNavigationType();
  const visit = (): Visit<View> => {
    const trip = lastTrip.key === location.key ? lastTrip : null;
    return {
      pathname: location.pathname,
      search: location.search,
      idx: historyIndex(),
      action,
      back: trip?.back ?? false,
      instant: trip?.drawn,
      view: { outlet, location },
    };
  };
  const [state, setState] = useState(() => ({ stack: firstStack(visit()), outlet, location }));
  let { stack } = state;
  if (state.outlet !== outlet || state.location !== location) {
    const top = stack.entries[stack.entries.length - 1];
    stack = state.location === location
      ? { ...stack, entries: [...stack.entries.slice(0, -1), { ...top, view: { outlet, location } }] }
      : nextStack(stack, visit());
    setState({ stack, outlet, location });
  }
  const settle = useCallback((turn: number) => setState((current) => (current.stack.turn === turn ? { ...current, stack: rested(current.stack) } : current)), []);
  return { stack, settle };
}

/** A screen drawn from where it was last in use, wherever the router is now. */
function Held({ view }: { view: View }) {
  const value = useMemo(() => ({ location: view.location, navigationType: "POP" }), [view.location]);
  return <LocationContext.Provider value={value as React.ContextType<typeof LocationContext>}>{view.outlet}</LocationContext.Provider>;
}

/**
 * Every screen is a layer of its own, with its own scroll. A new one moves in
 * over the last, which stays as it was beneath; going back moves it out again.
 */
export function Stage({ rail, dock }: {
  rail: (tab: string | null) => React.ReactNode;
  /** Drawn on the destinations' own layer, so a pushed screen covers it. */
  dock: (tab: string) => React.ReactNode;
}) {
  const { stack, settle } = useStack();
  const { entries, tabs, leaving } = stack;
  const top = entries[entries.length - 1];
  const compact = useCompactViewport();
  const still = useStill();
  const viewing = useMemo(() => ({ compact, still }), [compact, still]);
  const navigation = useNavigation();
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef(new Map<string, HTMLElement>());
  const shown = useRef(new Set<string>());
  const pace = useRef<Pace | undefined>(undefined);
  const returnTo = useRef(new Map<string, HTMLElement>());

  useLayoutEffect(() => setPlaces(entries.map((entry) => ({ path: entry.key, idx: entry.idx }))), [entries]);

  // Moves what the last change of screens set in motion.
  const turn = useRef(-1);
  const latest = useRef(stack);
  useLayoutEffect(() => { latest.current = stack; });
  useLayoutEffect(() => {
    const current = latest.current;
    const fresh = turn.current !== current.turn;
    turn.current = current.turn;
    const animations = arrange(layers.current, fresh ? current : { ...current, instant: true }, shown.current, viewing, pace.current);
    pace.current = undefined;
    let live = true;
    const done = () => {
      if (!live) return;
      rest(layers.current, latest.current, shown.current, viewing);
      settle(current.turn);
    };
    if (animations.length) void Promise.allSettled(animations.map((animation) => animation.finished)).then(done);
    else done();
    return () => { live = false; };
  }, [stack.turn, viewing, settle]);

  // The focus goes with the screen in use, and comes back to what opened it.
  const topKey = top.key;
  const before = useRef(topKey);
  useLayoutEffect(() => {
    if (before.current === topKey) return;
    const layer = layers.current.get(layerKey(latest.current.entries[latest.current.entries.length - 1]));
    const focused = document.activeElement;
    const back = returnTo.current.get(topKey);
    returnTo.current.delete(topKey);
    before.current = topKey;
    if (!layer || (focused && layer.contains(focused) && focused !== document.body)) return;
    (back?.isConnected ? back : layer.querySelector<HTMLElement>(".screen-surface"))?.focus({ preventScroll: true });
  }, [topKey]);
  const remember = (event: React.SyntheticEvent) => {
    const on = (event.target as HTMLElement).closest<HTMLElement>("a, button");
    if (on) returnTo.current.set(topKey, on);
  };

  const leave = useCallback(() => {
    const { entries } = latest.current;
    navigation.back?.(tabOf(entries[entries.length - 1].key) ?? "/app");
  }, [navigation]);

  // Escape puts the sheet away, unless something on it answers first.
  const overlay = isOverlay(top.presentation) && top.presentation !== "full";
  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("[data-radix-popper-content-wrapper], [role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']")) leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, leave]);

  useEffect(() => {
    const toTop = () => {
      const layer = layers.current.get(TAB_LAYER);
      layer?.querySelector(".screen-view:not([data-hidden]) > .screen-scroller")?.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    };
    window.addEventListener(TO_TOP, toTop);
    return () => window.removeEventListener(TO_TOP, toTop);
  }, [still]);

  // An iOS keyboard can leave the document itself scrolled; only the screens scroll here.
  useEffect(() => {
    const straighten = () => { if (window.scrollY && !document.activeElement?.matches("input, textarea")) window.scrollTo(0, 0); };
    const onBlur = () => setTimeout(straighten, 60);
    document.addEventListener("focusout", onBlur);
    return () => document.removeEventListener("focusout", onBlur);
  }, []);

  const beneath = entries[entries.length - 2];
  const layerOf = (entry: Entry | undefined) => (entry ? layers.current.get(layerKey(entry)) : undefined);
  const back = () => arrange(layers.current, { ...stack, instant: false, entering: top.key }, shown.current, viewing, { ms: 260, curve: "nav" });
  useStageGesture(stage, {
    top: () => {
      const layer = layerOf(top);
      if (!layer || !beneath || leaving.length || stack.entering) return null;
      return top.presentation === "push" || (compact && (top.presentation === "sheet" || top.presentation === "modal")) ? { presentation: top.presentation, layer } : null;
    },
    onMove: (offset) => {
      const layer = layerOf(top);
      if (!layer) return 0;
      shown.current.add(layerKey(beneath));
      return follow(layer, layerOf(beneath), top.presentation, offset, viewing);
    },
    onEnd: (away, velocity) => {
      if (!away) {
        const here = stack.turn;
        void Promise.allSettled(back().map((animation) => animation.finished)).then(() => {
          if (latest.current.turn === here) rest(layers.current, latest.current, shown.current, viewing);
        });
        return;
      }
      const layer = layerOf(top)?.querySelector<HTMLElement>(".screen-surface");
      const box = layer?.getBoundingClientRect();
      const left = box ? (top.presentation === "push" ? window.innerWidth - box.left : window.innerHeight - box.top) : 0;
      // Carries on at the speed the finger had, within what still reads as a move.
      pace.current = { ms: Math.min(420, Math.max(180, velocity > 0.1 ? (left / velocity) * 1.6 : 380)), curve: "nav" };
      const here = stack.turn;
      leave();
      setTimeout(() => { if (latest.current.turn === here) { pace.current = undefined; back(); } }, 600);
    },
  });

  const bind = useMemo(() => {
    const refs = new Map<string, (element: HTMLElement | null) => void>();
    return (key: string) => {
      let ref = refs.get(key);
      if (!ref) {
        ref = (element) => {
          if (element) layers.current.set(key, element);
          else { layers.current.delete(key); shown.current.delete(key); }
        };
        refs.set(key, ref);
      }
      return ref;
    };
  }, []);

  // Everything from the first overlay up lies over the rail.
  const over = entries.findIndex((entry) => isOverlay(entry.presentation));
  const depth = (i: number) => (over >= 0 && i >= over ? 50 : 1) + i;
  const root = entries[0];
  const tab = root.presentation === "tab" ? root.key : null;

  const layer = (entry: Entry<View>, z: number, active: boolean) => (
    <Layer active={active} entry={entry} key={entry.key} layerRef={bind(entry.key)} onClose={leave} z={z}>
      <ScreenScroller><Held view={entry.view} /></ScreenScroller>
    </Layer>
  );
  return (
    <div className="stage" onClickCapture={remember} ref={stage}>
      {rail(tab ?? tabOf(top.key))}
      {tabs.length ? (
        <Layer active={top.presentation === "tab"} entry={tab ? root : tabs[0]} layerRef={bind(TAB_LAYER)} onClose={leave} z={0}>
          {tabs.map((entry) => (
            <ScreenContext.Provider key={entry.key} value={{ presentation: "tab", active: entry.key === top.key }}>
              <ScreenScroller hidden={entry.key !== tab}><Held view={entry.key === tab ? root.view : entry.view} /></ScreenScroller>
            </ScreenContext.Provider>
          ))}
          {tab ? dock(tab) : null}
        </Layer>
      ) : null}
      {entries.map((entry, i) => (entry.presentation === "tab" ? null : layer(entry, depth(i), i === entries.length - 1)))}
      {leaving.map((entry, i) => layer(entry, (over >= 0 || isOverlay(entry.presentation) ? 70 : 20) + i, false))}
    </div>
  );
}

function Layer({ entry, z, active, layerRef, onClose, children }: {
  entry: Stack["entries"][number];
  z: number;
  active: boolean;
  layerRef: (element: HTMLElement | null) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { presentation } = entry;
  const overlay = presentation === "sheet" || presentation === "modal";
  const info = useMemo(() => ({ presentation, active }), [presentation, active]);
  return (
    <div className="screen" data-presentation={presentation} inert={!active} ref={layerRef} style={{ zIndex: z }}>
      {overlay ? <div aria-hidden className="screen-scrim" onClick={onClose} /> : null}
      <div {...(overlay ? { "aria-modal": true, role: "dialog" } : {})} className="screen-surface" tabIndex={-1}>
        {overlay ? <span aria-hidden className="screen-grabber" /> : null}
        <ScreenContext.Provider value={info}>{children}</ScreenContext.Provider>
        <div aria-hidden className="screen-dim" />
      </div>
    </div>
  );
}
