import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { DURATION } from "./motion";

/** Spread on an `Animated.View` whose opacity follows state. */
export const fade = {
  transitionProperty: "opacity",
  transitionDuration: DURATION.state,
  transitionTimingFunction: "ease-out",
} as const;

/**
 * A colour laid under a tile's content that fades in and out, so a tile never
 * jumps from one state to the next. Opacity is what animates: the palette's
 * colours follow light and dark natively and cannot be interpolated. It covers
 * the tile's border too when `outset` is the border's width.
 */
export function Tone({
  on,
  style,
  outset = 0,
}: {
  on: boolean;
  style: StyleProp<ViewStyle>;
  outset?: number;
}) {
  const edge = -outset;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", top: edge, right: edge, bottom: edge, left: edge },
        styles.curve,
        style,
        fade,
        { opacity: on ? 1 : 0 },
      ]}
    />
  );
}

const styles = StyleSheet.create({ curve: { borderCurve: "continuous" } });
