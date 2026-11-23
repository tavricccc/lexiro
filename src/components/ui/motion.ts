import {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  withTiming,
  type EntryAnimationsValues,
} from "react-native-reanimated";

/**
 * Three speeds for everything that moves: an answer to a finger, a change of
 * state, and a change of place; `morph` is glass flowing into other glass.
 * Nothing floats up into place: pages use the system's transition, and
 * content that appears fades quickly where it stands. Springs are kept for
 * things thrown by hand (the flashcards); elsewhere their settle read as
 * drifting. Reanimated skips all of these when the system asks for reduced motion.
 */
export const DURATION = { press: 100, state: 180, move: 300, morph: 450 } as const;

/** Fast off the mark, then a long soft landing with no overshoot. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
/** Gentler for things that travel, so a move is followed rather than jumped. */
export const EASE_MOVE = Easing.bezier(0.25, 0.8, 0.25, 1);

/** `withTiming` settings. */
export const timing = {
  press: { duration: DURATION.press, easing: EASE_OUT },
  state: { duration: DURATION.state, easing: EASE_OUT },
  move: { duration: DURATION.move, easing: EASE_MOVE },
} as const;

/** Swapping one view for another, such as a tab panel, or a row being added. */
export const swapIn = FadeIn.duration(DURATION.state);
export const swapOut = FadeOut.duration(DURATION.press);

/** A page's cover lifting: fades the page in without touching the opacity of its glass. */
export const uncover = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0 } },
  animationDuration: DURATION.state,
  animationTimingFunction: "ease-out",
  animationFillMode: "forwards",
} as const;

/** A pressed row letting go. */
export const highlightOut = FadeOut.duration(DURATION.move);

/** Neighbours glide when something above them changes size. */
export const glide = LinearTransition.duration(DURATION.move).easing(EASE_MOVE);

/** A mark or badge appearing: a check, a crown, a finish icon. */
export const pop = ZoomIn.duration(DURATION.state).easing(EASE_OUT);
export const popOut = ZoomOut.duration(DURATION.press);

/** A banner in the page: from above, and back out through it. */
export const dropIn = FadeInUp.duration(DURATION.move).easing(EASE_MOVE);
export const dropOut = FadeOutUp.duration(DURATION.state);

/**
 * Entrances for views that hold Liquid Glass. They only travel: iOS does not
 * draw glass at all under a parent whose opacity has been 0.
 */
const along = (axis: "translateX" | "translateY", from: number) => {
  "worklet";
  const at = (value: number) => (axis === "translateX" ? { translateX: value } : { translateY: value });
  return {
    initialValues: { transform: [at(from)] },
    animations: {
      transform: [
        axis === "translateX"
          ? { translateX: withTiming(0, timing.move) }
          : { translateY: withTiming(0, timing.move) },
      ],
    },
  };
};
/** The next question sliding in, or the one before, like a pushed page. */
export const slideNext = (values: EntryAnimationsValues) => {
  "worklet";
  return along("translateX", values.windowWidth);
};
export const slideBack = (values: EntryAnimationsValues) => {
  "worklet";
  return along("translateX", -values.windowWidth);
};
/** Down from above the top edge: a toast. */
export const toastIn = () => {
  "worklet";
  return along("translateY", -140);
};
