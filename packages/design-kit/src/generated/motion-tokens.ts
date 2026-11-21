// Generated from config/motion.config.json by scripts/generate-motion.mjs.
// Do not edit: change the config and run `bun run generate:all`.

/** Rungs of the duration ladder, in seconds, for animations driven from JavaScript. */
export const motionSeconds = {
  touch: 0.06,
  control: 0.14,
  reveal: 0.24,
  nav: 0.24,
  sheet: 0.26,
  controlExit: 0.12,
  sheetExit: 0.2,
} as const;

/** The sanctioned easing curves as cubic-bezier control points. */
export const motionEasing = {
  arrive: [0.2, 0, 0, 1],
  depart: [0.4, 0, 1, 1],
  move: [0.2, 0, 0, 1],
  nav: [0.2, 0, 0, 1],
  navDepart: [0.4, 0, 1, 1],
  bounce: [0.2, 0, 0, 1],
} as const;

/** How far things travel, as the CSS values the stylesheet uses. */
export const motionTravel = {
  lift: "2px",
  rise: "6px",
  pressScale: "0.99",
  cardPressScale: "0.996",
  surfaceScale: "0.985",
  routeTravel: "16px",
} as const;

/** Indeterminate loops, in seconds. They repeat, so they sit outside the ladder. */
export const motionLoopSeconds = {
  spin: 0.7,
  sweep: 0.95,
  pulse: 1.6,
} as const;

export type MotionRung = keyof typeof motionSeconds;
export type MotionCurve = keyof typeof motionEasing;
export type MotionLoop = keyof typeof motionLoopSeconds;
