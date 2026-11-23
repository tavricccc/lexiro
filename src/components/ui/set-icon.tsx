import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import type { SetIcon as SetIconName } from "@/core/contract";
import { colors } from "@/lib/theme";

export const SET_ICON_SYMBOLS: Record<SetIconName, SymbolViewProps["name"]> = {
  books: "books.vertical.fill",
  "graduation-cap": "graduationcap.fill",
  briefcase: "briefcase.fill",
  "bookmark-simple": "bookmark.fill",
  "airplane-tilt": "airplane",
  newspaper: "newspaper.fill",
};

export const SET_ICON_LABELS: Record<SetIconName, string> = {
  books: "書本",
  "graduation-cap": "學士帽",
  briefcase: "公事包",
  "bookmark-simple": "書籤",
  "airplane-tilt": "飛機",
  newspaper: "報紙",
};

/** Every set shares Lexiro's pine green accent; its icon distinguishes it. */
export function SetIcon({
  icon,
  size = 42,
  style,
}: {
  icon: SetIconName;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const symbolSize = Math.round(size * 0.52);
  const borderRadius = Math.round(size * 0.28);
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius },
        style,
      ]}
    >
      <SymbolView
        name={SET_ICON_SYMBOLS[icon] ?? "books.vertical.fill"}
        size={symbolSize}
        weight="medium"
        tintColor={colors.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceRaised,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
});
