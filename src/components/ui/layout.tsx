import type { UseQueryResult } from "@tanstack/react-query";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";

import { OfflineBanner } from "@/components/offline-banner";
import { errorMessage } from "@/data/api";
import { colors, radius, space, type } from "@/lib/theme";
import { Button } from "./button";
import { swapIn } from "./motion";
import { useTransitionDone } from "./use-transition-done";

export const CONTENT_MAX_WIDTH = 720;
export const SPLIT_MAX_WIDTH = 1120;
const SPLIT_MIN_WINDOW = 960;

/** Whether the window has room for a reading passage beside its question (iPad landscape). */
export function useSplitView() {
  return useWindowDimensions().width >= SPLIT_MIN_WINDOW;
}

/** Standard scrolling screen under a native iOS header. */
export function Screen({
  children,
  showOffline = true,
  ...props
}: ScrollViewProps & { children: ReactNode; showOffline?: boolean }) {
  const ready = useTransitionDone();
  const [instant] = useState(ready);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
      {...props}
      contentContainerStyle={[styles.content, props.contentContainerStyle]}
    >
      {ready ? (
        <Animated.View entering={instant ? undefined : swapIn} style={styles.body}>
          <LayoutAnimationConfig skipEntering>
            {showOffline ? <OfflineBanner /> : null}
            {children}
          </LayoutAnimationConfig>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

/** Form screen powered by react-native-keyboard-controller for 120fps native keyboard tracking. */
export function KeyboardScreen({
  children,
  showOffline = true,
  bottomOffset = 84,
  contentContainerStyle,
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  showOffline?: boolean;
  bottomOffset?: number;
}) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
      {...props}
      contentContainerStyle={[styles.content, contentContainerStyle]}
    >
      <View style={styles.body}>
        {showOffline ? <OfflineBanner /> : null}
        {children}
      </View>
    </KeyboardAwareScrollView>
  );
}

/** White card on the quiet canvas. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** Compact metric / stat tile. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tile, style]}>{children}</View>;
}

export function Chip({
  label,
  tone = "default",
  latinFont = false,
}: {
  label: string;
  tone?: "default" | "accent" | "positive" | "danger" | "info" | "highlight";
  latinFont?: boolean;
}) {
  const bg =
    tone === "accent"
      ? colors.accentSoft
      : tone === "positive"
        ? colors.positiveSoft
        : tone === "danger"
          ? colors.dangerSoft
          : tone === "info"
            ? colors.infoSoft
            : tone === "highlight"
              ? colors.highlightSoft
              : colors.surfaceRaised;
  const textColor =
    tone === "accent"
      ? colors.accentInk
      : tone === "positive"
        ? colors.positiveInk
        : tone === "danger"
          ? colors.dangerInk
          : tone === "info"
            ? colors.info
            : tone === "highlight"
              ? colors.highlight
              : colors.inkMuted;

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text
        style={[
          styles.chipText,
          { color: textColor },
          latinFont && { fontFamily: "AlbertSans-600" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  icon = "books.vertical",
  action,
}: {
  title: string;
  description?: string;
  icon?: SymbolViewProps["name"];
  action?: ReactNode;
}) {
  return (
    <Panel style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <SymbolView name={icon} size={26} weight="medium" tintColor={colors.accentInk} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyBody}>{description}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Panel>
  );
}

/** Handles pending / error / ready states for any TanStack Query screen. */
export function Loaded<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, unknown>;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isPending) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.contrast as string} />
      </View>
    );
  }
  return (
    <EmptyState
      icon="wifi.exclamationmark"
      title="讀取失敗"
      description={errorMessage(query.error)}
      action={
        <Button
          label="重試"
          icon="arrow.clockwise"
          variant="secondary"
          onPress={() => void query.refetch()}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    paddingBottom: 56,
  },
  body: {
    gap: 18,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 18,
    gap: 12,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 16,
    gap: 4,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.chip,
    borderCurve: "continuous",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionTitle: {
    ...type.section,
    color: colors.inkMuted,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    ...type.title,
    fontSize: 19,
    color: colors.ink,
    textAlign: "center",
  },
  emptyBody: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 10,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
