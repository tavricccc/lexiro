import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, latin, plain, space, type } from "@/lib/theme";

/** Compact native-style top bar for formSheet & modal screens. */
export function SheetHeader({
  title,
  latinTitle = false,
  subtitle,
  leading,
  trailing,
  onClose,
}: {
  title: string;
  latinTitle?: boolean;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClose?: () => void;
}) {
  const canvas = useColorScheme() === "dark" ? plain.canvas.dark : plain.canvas.light;
  return (
    <View style={styles.bar}>
      {/* Soft edge: content fades out under the bar instead of being cut. */}
      <View
        pointerEvents="none"
        style={[
          styles.fade,
          { experimental_backgroundImage: `linear-gradient(to bottom, ${canvas}, ${canvas}00)` },
        ]}
      />
      <View style={styles.titleBlock}>
        <Text
          style={[styles.title, latinTitle && latin.bold]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {leading}
        {trailing}
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="關閉"
          onPress={() => {
            haptics.select();
            if (onClose) onClose();
            else router.back();
          }}
          style={styles.closeBtn}
        >
          <SymbolView name="xmark" size={14} weight="bold" tintColor={colors.inkMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: colors.canvas,
    zIndex: 1,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    height: 24,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  subtitle: {
    ...type.hint,
    color: colors.inkMuted,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
