import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, latin, space, type } from "@/lib/theme";

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
  return (
    <View style={styles.bar}>
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
