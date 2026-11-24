import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

import { colors } from "@/lib/theme";
import { highlightOut } from "./motion";

/**
 * A list row that highlights like the system: at once under the finger,
 * fading out on release, and not while a scroll is only passing over it.
 * The highlight exists only while pressed, so a long list pays nothing for it.
 */
export function PressableRow({
  style,
  children,
  ...props
}: Omit<PressableProps, "style" | "children" | "onPressIn" | "onPressOut"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [lit, setLit] = useState(false);
  if (!props.onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      unstable_pressDelay={60}
      {...props}
      onPressIn={() => setLit(true)}
      onPressOut={() => setLit(false)}
      style={style}
    >
      {lit ? (
        <Animated.View exiting={highlightOut} pointerEvents="none" style={styles.highlight} />
      ) : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlight: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfacePressed },
});
