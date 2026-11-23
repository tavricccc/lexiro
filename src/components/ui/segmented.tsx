import { startTransition, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { colors, hexPalette, radius } from "@/lib/theme";
import { PressableScale } from "./pressable-scale";

const PADDING = 4;
const GAP = 4;
const SLIDE = { duration: 200, easing: Easing.out(Easing.cubic) };

/**
 * Equal-width sliding-pill segmented control (for 2–4 fixed options) or
 * horizontally scrollable pill tabs (when `scrollable` is true, e.g. folders).
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}) {
  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <PressableScale
              key={String(option.value)}
              scaleTo={0.96}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (selected) return;
                haptics.select();
                startTransition(() => onChange(option.value));
              }}
              style={[styles.scrollPill, selected && styles.scrollPillActive]}
            >
              <Text style={[styles.scrollLabel, selected && styles.scrollLabelActive]}>
                {option.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    );
  }

  return <EqualSegmented options={options} value={value} onChange={onChange} />;
}

function EqualSegmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useSharedValue(index);

  useEffect(() => {
    position.set(withTiming(index, SLIDE));
  }, [index, position]);

  const segment = width
    ? (width - PADDING * 2 - GAP * (options.length - 1)) / Math.max(1, options.length)
    : 0;
  const pill = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: position.value * (segment + GAP) }],
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width ? <Animated.View style={[styles.pill, pill]} /> : null}
      {options.map((option, optionIndex) => (
        <Segment
          key={String(option.value)}
          label={option.label}
          index={optionIndex}
          position={position}
          selected={optionIndex === index}
          onPress={() => {
            if (optionIndex === index) return;
            position.set(withTiming(optionIndex, SLIDE));
            haptics.select();
            startTransition(() => onChange(option.value));
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  position,
  selected,
  onPress,
}: {
  label: string;
  index: number;
  position: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = hexPalette(useColorScheme() === "dark");
  const cover = useDerivedValue(() => Math.max(0, 1 - Math.abs(position.value - index)));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(cover.value, [0, 1], [palette.inkMuted, palette.canvas]),
  }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.segment}
    >
      <Animated.Text
        style={[styles.label, selected && styles.selectedLabel, text]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PADDING,
    gap: GAP,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  pill: {
    position: "absolute",
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.ink,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  label: { fontSize: 14, fontWeight: "500" },
  selectedLabel: { fontWeight: "600" },
  scrollRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  scrollPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollPillActive: {
    backgroundColor: colors.ink,
  },
  scrollLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.inkMuted,
  },
  scrollLabelActive: {
    color: colors.canvas,
    fontWeight: "600",
  },
});
