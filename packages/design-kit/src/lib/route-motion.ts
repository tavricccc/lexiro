import { motionTravel } from "../generated/motion-tokens";
import { timing } from "./motion-timing";

export type RouteDirection = -1 | 0 | 1;

/**
 * How a screen enters, from where the two screens sit in the app's
 * hierarchy (0 for the primary destinations, +1 per step into a child):
 * deeper is pushed in from the right, shallower returns from the left, and
 * the same level cross-fades, as tabs do.
 */
export function routeDirection(fromLevel: number, toLevel: number): RouteDirection {
  return toLevel > fromLevel ? 1 : toLevel < fromLevel ? -1 : 0;
}

const TRAVEL = Number.parseFloat(motionTravel.routeTravel);

/** Props for the `motion.div` keyed by the screen's path. Pass 0 under reduced motion. */
export function routeMotion(direction: RouteDirection) {
  return {
    initial: { opacity: 0, x: direction * TRAVEL },
    animate: { opacity: 1, x: 0 },
    transition: direction ? timing("nav", "nav") : timing("control", "arrive"),
  };
}
