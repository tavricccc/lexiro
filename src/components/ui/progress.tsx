import { useEffect } from "react";
import { StyleSheet, View, type ColorValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/theme";

const GROW = { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export function ProgressBar({
  value,
  tint = colors.contrast,
  height = 6,
}: {
  value: number;
  tint?: ColorValue;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const width = useSharedValue(clamped * 100);

  useEffect(() => {
    width.set(withTiming(clamped * 100, GROW));
  }, [clamped, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: tint, borderRadius: height / 2 },
          fill,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  fill: {
    height: "100%",
  },
});
