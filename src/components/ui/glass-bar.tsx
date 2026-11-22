import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius } from "@/lib/theme";

const hasGlass = isLiquidGlassAvailable();

/**
 * Floating pill/card container that adopts iOS 26 Liquid Glass when available,
 * and falls back gracefully to an elevated opaque card on earlier systems.
 */
export function GlassSurface({
  children,
  style,
  pill = true,
  interactive = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pill?: boolean;
  interactive?: boolean;
}) {
  const shape = pill ? styles.pill : styles.card;
  if (hasGlass) {
    return (
      <GlassView
        style={[shape, styles.glass, style]}
        glassEffectStyle="regular"
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[shape, styles.fallback, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    borderCurve: "continuous",
  },
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  glass: {
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: colors.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    boxShadow: "0 12px 32px rgba(17,38,30,0.14)",
  },
});
