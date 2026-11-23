import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

/**
 * Three speeds for everything that moves: an answer to a finger, a change of
 * state, and a change of place. Springs are kept for things thrown by hand
 * (the flashcards); elsewhere their settle read as drifting. Reanimated skips
 * all of these when the system asks for reduced motion.
 */
export const DURATION = { press: 100, state: 180, move: 300 } as const;

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

/** Neighbours glide when something above them changes size. */
export const glide = LinearTransition.duration(DURATION.move).easing(EASE_MOVE);

/** A mark or badge appearing: a check, a crown, a finish icon. */
export const pop = ZoomIn.duration(DURATION.state).easing(EASE_OUT);
export const popOut = ZoomOut.duration(DURATION.press);

/** Short fade-and-shift entrances. */
export const enterDown = FadeInDown.duration(DURATION.move).easing(EASE_MOVE);
/** From the top edge, and back out through it: toasts and banners. */
export const dropIn = FadeInUp.duration(DURATION.move).easing(EASE_MOVE);
export const dropOut = FadeOutUp.duration(DURATION.state);
/** The next question sliding in, or the one before. */
export const slideNext = FadeInRight.duration(DURATION.move).easing(EASE_MOVE);
export const slideBack = FadeInLeft.duration(DURATION.move).easing(EASE_MOVE);
