import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";

import { DURATION, breathe, swapIn, timing } from "@/components/ui/motion";
import { colors, radius, type } from "@/lib/theme";

const BAR_WIDTH = 160;

/**
 * Covers the launch while it looks for a newer version and fetches it. The mark
 * stands exactly where the splash has it, and the cover lifts once settled.
 */
export function LaunchUpdate({
  done,
  updating,
  progress,
}: {
  done: boolean;
  updating: boolean;
  progress: number;
}) {
  const [gone, setGone] = useState(done);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setGone(true), DURATION.move + 50);
    return () => clearTimeout(timer);
  }, [done]);

  const lift = useAnimatedStyle(() => ({ opacity: withTiming(done ? 0 : 1, timing.move) }), [done]);
  const fill = useAnimatedStyle(
    () => ({ transform: [{ translateX: withTiming((progress - 1) * BAR_WIDTH, timing.move) }] }),
    [progress],
  );

  if (gone) return null;
  const cover = (
    <Animated.View pointerEvents={done ? "none" : "auto"} style={[styles.cover, lift]}>
      <Animated.View style={breathe}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={styles.mark}
          resizeMode="contain"
        />
      </Animated.View>
      {updating ? (
        <Animated.View
          entering={swapIn}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="正在更新"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          style={styles.status}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fill]} />
          </View>
          <Text style={styles.label}>正在更新</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
  // A window overlay, so a sheet opened by a link at launch stays underneath too.
  return Platform.OS === "ios" ? <FullWindowOverlay>{cover}</FullWindowOverlay> : cover;
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { width: 120, height: 146 },
  status: { position: "absolute", top: "50%", marginTop: 108, alignItems: "center", gap: 14 },
  track: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
    overflow: "hidden",
  },
  fill: { width: BAR_WIDTH, height: 4, borderRadius: radius.pill, backgroundColor: colors.contrast },
  label: { ...type.body, color: colors.inkMuted },
});
