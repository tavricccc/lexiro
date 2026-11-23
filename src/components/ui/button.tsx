import {
  Button as SwiftButton,
  HStack,
  Host,
  Image,
  ProgressView,
  Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  /** A switched-on toggle. */
  | "accent"
  | "danger"
  | "hero"
  | "heroGhost";

export type ButtonSize = "sm" | "md" | "lg";

type SwiftSymbol = ComponentProps<typeof Image>["systemName"];

/** `tint` fills a prominent button, and washes a bordered one. */
const fills: Record<
  ButtonVariant,
  { bg: ColorValue; text: ColorValue; border?: ColorValue; tint: ColorValue; prominent?: boolean }
> = {
  primary: { bg: colors.contrast, text: colors.onContrast, tint: colors.contrast, prominent: true },
  solid: { bg: colors.heroBg, text: colors.heroText, tint: colors.heroBg, prominent: true },
  secondary: { bg: colors.surface, text: colors.ink, border: colors.line, tint: colors.inkMuted },
  ghost: { bg: colors.surfaceRaised, text: colors.ink, tint: colors.inkMuted },
  accent: { bg: colors.accentSoft, text: colors.accentInk, tint: colors.contrast },
  danger: { bg: colors.dangerSoft, text: colors.dangerInk, tint: colors.danger },
  hero: {
    bg: colors.heroButtonBg,
    text: colors.heroButtonText,
    tint: colors.heroButtonBg,
    prominent: true,
  },
  heroGhost: { bg: colors.heroGhostBg, text: colors.heroText, tint: colors.heroText },
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
  const { fontScale } = useWindowDimensions();

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

  const press = () => {
    if (inactive) return;
    fireHaptic();
    onPress?.();
  };

  if (Platform.OS === "ios") {
    const symbol = (name: SymbolViewProps["name"], points: number) => (
      <Image systemName={name as SwiftSymbol} size={points * fontScale} />
    );
    return (
      <View style={style}>
        {/* Holds the button's size from the first frame; SwiftUI reports its own too late. */}
        <View
          accessibilityElementsHidden
          pointerEvents="none"
          style={[
            styles.content,
            styles.sizer,
            { minHeight: dims.minHeight, paddingHorizontal: dims.paddingHorizontal },
          ]}
        >
          {icon ? <View style={{ width: dims.icon * 1.25 * fontScale }} /> : null}
          <Text style={[styles.label, { fontSize: dims.fontSize }]} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon ? <View style={{ width: dims.icon * 1.25 * fontScale }} /> : null}
        </View>
        <Host style={StyleSheet.absoluteFill} ignoreSafeArea="all">
          <SwiftButton
            onPress={press}
            modifiers={[
              buttonStyle(fill.prominent ? "borderedProminent" : "bordered"),
              buttonBorderShape("capsule"),
              controlSize("regular"),
              tint(fill.tint),
              accessibilityLabel(label),
              disabledModifier(!!disabled),
            ]}
          >
            <HStack
              spacing={7}
              modifiers={[
                frame({ maxWidth: 10_000, maxHeight: 10_000 }),
                font({ size: dims.fontSize * fontScale, weight: "semibold" }),
                ...(disabled ? [] : [foregroundStyle(fill.text)]),
              ]}
            >
              {busy ? (
                <ProgressView modifiers={[tint(fill.text)]} />
              ) : (
                <>
                  {icon ? symbol(icon, dims.icon) : null}
                  <SwiftText modifiers={[lineLimit(1), minimumScaleFactor(0.8)]}>{label}</SwiftText>
                  {trailingIcon ? symbol(trailingIcon, dims.icon - 1) : null}
                </>
              )}
            </HStack>
          </SwiftButton>
        </Host>
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={press}
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

/** A round button holding one symbol. */
export function IconButton({
  label,
  icon,
  size = 38,
  destructive,
  disabled,
  onPress,
}: {
  label: string;
  icon: SymbolViewProps["name"];
  size?: number;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = destructive ? colors.danger : colors.ink;
  const box = { width: size, height: size };
  const press = () => {
    haptics.select();
    onPress();
  };
  if (Platform.OS === "ios") {
    return (
      <Host style={box} ignoreSafeArea="all">
        <SwiftButton
          onPress={press}
          modifiers={[
            buttonStyle("bordered"),
            buttonBorderShape("circle"),
            controlSize("mini"),
            tint(color),
            accessibilityLabel(label),
            disabledModifier(!!disabled),
          ]}
        >
          <Image
            systemName={icon as SwiftSymbol}
            size={size * 0.38}
            modifiers={[frame({ maxWidth: 10_000, maxHeight: 10_000 })]}
          />
        </SwiftButton>
      </Host>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={press}
      style={[styles.button, styles.round, box, disabled && styles.disabled]}
    >
      <SymbolView name={icon} size={size * 0.38} weight="semibold" tintColor={color} />
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
  sizer: { opacity: 0 },
  round: { backgroundColor: colors.surfaceRaised },
  label: {
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.4,
  },
});
