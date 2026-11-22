import { SymbolView, type SymbolViewProps } from "expo-symbols";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";
import { PressableScale } from "./pressable-scale";

export type ButtonVariant =
  | "primary"
  | "solid"
  | "secondary"
  | "ghost"
  | "danger"
  | "hero"
  | "heroGhost";

export type ButtonSize = "sm" | "md" | "lg";

const fills: Record<ButtonVariant, { bg: ColorValue; text: ColorValue; border?: ColorValue }> = {
  primary: { bg: colors.contrast, text: colors.onContrast },
  solid: { bg: colors.heroBg, text: colors.heroText },
  secondary: { bg: colors.surface, text: colors.ink, border: colors.line },
  ghost: { bg: colors.surfaceRaised, text: colors.ink },
  danger: { bg: colors.dangerSoft, text: colors.dangerInk },
  hero: { bg: colors.heroButtonBg, text: colors.heroButtonText },
  heroGhost: { bg: colors.heroGhostBg, text: colors.heroText },
};

const heights: Record<ButtonSize, { minHeight: number; paddingHorizontal: number; fontSize: number; icon: number }> = {
  sm: { minHeight: 38, paddingHorizontal: 14, fontSize: 14, icon: 15 },
  md: { minHeight: 46, paddingHorizontal: 18, fontSize: 16, icon: 16 },
  lg: { minHeight: 52, paddingHorizontal: 22, fontSize: 17, icon: 17 },
};

export function Button({
  label,
  icon,
  trailingIcon,
  variant = "primary",
  size = "md",
  busy,
  disabled,
  haptic = "auto",
  onPress,
  style,
}: {
  label: string;
  icon?: SymbolViewProps["name"];
  trailingIcon?: SymbolViewProps["name"];
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  disabled?: boolean;
  haptic?: "auto" | "confirm" | "tap" | "none";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = fills[variant];
  const dims = heights[size];
  const inactive = disabled || busy;

  const fireHaptic = () => {
    if (haptic === "none") return;
    if (haptic === "confirm") {
      haptics.confirm();
      return;
    }
    if (haptic === "tap") {
      haptics.tap();
      return;
    }
    if (variant === "primary" || variant === "solid" || variant === "hero") {
      haptics.tap();
    } else {
      haptics.select();
    }
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={() => {
        fireHaptic();
        onPress?.();
      }}
      style={[
        styles.button,
        {
          minHeight: dims.minHeight,
          paddingHorizontal: dims.paddingHorizontal,
          backgroundColor: fill.bg,
          borderWidth: fill.border ? StyleSheet.hairlineWidth : 0,
          borderColor: fill.border,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {busy ? (
          <ActivityIndicator color={fill.text} size="small" />
        ) : icon ? (
          <SymbolView name={icon} size={dims.icon} weight="semibold" tintColor={fill.text} />
        ) : null}
        <Text
          style={[styles.label, { color: fill.text, fontSize: dims.fontSize }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {!busy && trailingIcon ? (
          <SymbolView
            name={trailingIcon}
            size={dims.icon - 1}
            weight="semibold"
            tintColor={fill.text}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    borderCurve: "continuous",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  label: {
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.4,
  },
});
