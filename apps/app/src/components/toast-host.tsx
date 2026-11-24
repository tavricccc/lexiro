import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { DURATION, dropOut, toastIn } from "@/components/ui/motion";
import { colors, radius, type } from "@/lib/theme";
import { toast, useToasts, type ToastMessage } from "@/platform/toast";

const ICONS = {
  success: "checkmark.circle.fill",
  error: "exclamationmark.triangle.fill",
  info: "info.circle.fill",
} as const;

const hasGlass = isLiquidGlassAvailable();

/**
 * Floating top toast capsule with Liquid Glass on iOS 26 and crisp elevated surface elsewhere. On iOS it
 * sits in a window overlay, mounted with each toast, so native sheets never cover it.
 */
export function ToastHost() {
  const current = useToasts((state) => state.current);
  // The overlay outlives its toast, or the toast would vanish without leaving.
  const [overlay, setOverlay] = useState<number | null>(null);
  if (current && current.id !== overlay) setOverlay(current.id);
  useEffect(() => {
    if (current) return;
    const timer = setTimeout(() => setOverlay(null), DURATION.state + 50);
    return () => clearTimeout(timer);
  }, [current]);

  const pill = current ? <ToastPill key={current.id} toast={current} /> : null;
  if (Platform.OS !== "ios") return pill;
  if (overlay === null) return null;
  return (
    <FullWindowOverlay key={overlay} unstable_accessibilityContainerViewIsModal={false}>
      {pill}
    </FullWindowOverlay>
  );
}

function ToastPill({ toast: current }: { toast: ToastMessage }) {
  const insets = useSafeAreaInsets();
  const iconTint =
    current.kind === "error"
      ? colors.danger
      : current.kind === "success"
        ? colors.positive
        : colors.contrast;

  const content = (
    <Pressable onPress={toast.dismiss} style={styles.inner} accessibilityRole="alert">
      <SymbolView name={ICONS[current.kind]} size={18} weight="semibold" tintColor={iconTint} />
      <Text style={styles.text} numberOfLines={3}>
        {current.text}
      </Text>
    </Pressable>
  );

  return (
    <Animated.View
      entering={toastIn}
      exiting={dropOut}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {hasGlass ? (
        <GlassView style={styles.glassPill} glassEffectStyle="regular" isInteractive>
          {content}
        </GlassView>
      ) : (
        <Animated.View style={styles.fallbackPill}>{content}</Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  glassPill: {
    borderRadius: radius.pill,
    borderCurve: "continuous",
    overflow: "hidden",
    maxWidth: 420,
  },
  fallbackPill: {
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    boxShadow: "0 10px 28px rgba(17,38,30,0.14)",
    maxWidth: 420,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  text: {
    ...type.body,
    fontWeight: "500",
    color: colors.ink,
    flexShrink: 1,
  },
});
