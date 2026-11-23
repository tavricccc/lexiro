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

export const standardHeaderOptions = {
  ...softEdges,
  headerLargeTitleEnabled: false,
  headerTransparent: false,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  headerTintColor: colors.ink as string,
  headerStyle: { backgroundColor: colors.canvas as string },
  contentStyle: { backgroundColor: colors.canvas },
} as const;
