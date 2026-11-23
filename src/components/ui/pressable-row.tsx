import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors } from "@/lib/theme";
import { timing } from "./motion";

/**
 * A list row that highlights like the system's: at once under the finger,
 * fading out on release, and not while a scroll is only passing over it.
 */
export function PressableRow({
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const lit = useSharedValue(0);
  const highlight = useAnimatedStyle(() => ({ opacity: lit.value }));
  return (
    <Pressable
      unstable_pressDelay={60}
      {...props}
      onPressIn={(event) => {
        lit.set(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        lit.set(withTiming(0, timing.move));
        onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View pointerEvents="none" style={[styles.highlight, highlight]} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlight: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfacePressed },
});
