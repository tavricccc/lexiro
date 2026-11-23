import { colors } from "@/lib/theme";

/** iOS 26: content fades softly under the bars on every edge. */
export const softEdges = {
  scrollEdgeEffects: { top: "soft", bottom: "soft", left: "soft", right: "soft" },
} as const;

/** Native iOS large title over the quiet v2 canvas; collapses into the nav bar on scroll. */
export const largeTitleOptions = {
  ...softEdges,
  headerLargeTitleEnabled: true,
  headerTransparent: true,
  headerLargeTitleShadowVisible: false,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  headerTintColor: colors.ink as string,
  headerLargeTitleStyle: { fontWeight: "700" },
  contentStyle: { backgroundColor: colors.canvas },
} as const;

/** Sheets and modals: a native bar whose buttons `SheetHeader` sets. */
export const modalHeaderOptions = {
  ...softEdges,
  headerShown: true,
  headerTransparent: true,
  headerShadowVisible: false,
  headerBackVisible: false,
  headerTintColor: colors.ink as string,
  title: "",
} as const;

export const standardHeaderOptions = {
  ...softEdges,
  headerLargeTitleEnabled: false,
  headerTransparent: true,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  headerTintColor: colors.ink as string,
  contentStyle: { backgroundColor: colors.canvas },
} as const;
