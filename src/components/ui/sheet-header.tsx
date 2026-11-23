import { router, Stack } from "expo-router";
import type { ComponentProps } from "react";

import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";

type ScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>["options"]>,
  (...args: never[]) => unknown
>;
type HeaderItem = ReturnType<NonNullable<ScreenOptions["unstable_headerRightItems"]>>[number];
type Button = Extract<HeaderItem, { type: "button" }>;
type Symbol = Extract<NonNullable<Button["icon"]>, { type: "sfSymbol" }>["name"];

/** An icon button for the native navigation bar. */
export function barButton(
  label: string,
  symbol: Symbol,
  onPress: () => void,
  more: Partial<Button> = {},
): Button {
  return {
    type: "button",
    label,
    accessibilityLabel: label,
    icon: { type: "sfSymbol", name: symbol },
    tintColor: colors.ink,
    onPress: () => {
      haptics.select();
      onPress();
    },
    ...more,
  };
}

/** An icon button in the native navigation bar that opens a menu. */
export function barMenu(
  label: string,
  symbol: Symbol,
  items: {
    label: string;
    symbol: Symbol;
    destructive?: boolean;
    disabled?: boolean;
    onPress: () => void;
  }[],
): HeaderItem {
  return {
    type: "menu",
    label,
    accessibilityLabel: label,
    icon: { type: "sfSymbol", name: symbol },
    tintColor: colors.ink,
    menu: {
      items: items.map((item) => ({
        type: "action",
        label: item.label,
        icon: { type: "sfSymbol", name: item.symbol },
        destructive: item.destructive,
        disabled: item.disabled,
        onPress: () => {
          haptics.select();
          item.onPress();
        },
      })),
    },
  };
}

/**
 * Title and close button of a sheet or modal, in its native navigation bar. The
 * route must use `modalHeaderOptions` in the root layout: showing the bar later
 * would remount the screen.
 */
export function SheetHeader({
  title,
  items = [],
  closeLabel = "關閉",
}: {
  title: string;
  /** Buttons on the leading side, opposite the close button. */
  items?: HeaderItem[];
  closeLabel?: string;
}) {
  return (
    <Stack.Screen
      options={{
        title,
        unstable_headerLeftItems: () => items,
        unstable_headerRightItems: () => [barButton(closeLabel, "xmark", () => router.back())],
      }}
    />
  );
}
