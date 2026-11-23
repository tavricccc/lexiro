import { timing } from "./motion-timing";

/** Props for the `motion.div` keyed by the screen's path: a quick fade, with no travel. */
export const routeMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: timing("touch", "move"),
};
