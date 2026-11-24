import { timing } from "./motion-timing";

/**
 * Variants for a run of screens inside one screen (questions, live rounds):
 * the next pushes the last one off, edge to edge, so the two never show through
 * each other.
 * `custom` is the direction: 1 onwards, -1 back, 0 for a plain fade.
 */
export const stepMotion = {
  enter: (direction: number) => ({ x: direction ? `${direction * 100}%` : 0, opacity: direction ? 1 : 0 }),
  rest: { x: 0, opacity: 1, transition: timing("nav", "nav") },
  leave: (direction: number) => ({ x: direction ? `${direction * -100}%` : 0, opacity: direction ? 1 : 0, transition: timing(direction ? "nav" : "controlExit", "nav") }),
};
