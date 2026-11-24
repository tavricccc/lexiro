import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { timing } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that sinks a little under the finger and eases back: no spring, so nothing wobbles. */
export function PressableScale({
  scaleTo = 0.96,
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, timing.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, timing.state));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
