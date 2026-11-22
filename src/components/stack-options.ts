import { colors } from "@/lib/theme";

/** Native iOS large title over the quiet v2 canvas; collapses into the nav bar on scroll. */
export const largeTitleOptions = {
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
  headerLargeTitleEnabled: false,
  headerTransparent: false,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  headerTintColor: colors.ink as string,
  headerStyle: { backgroundColor: colors.canvas as string },
  contentStyle: { backgroundColor: colors.canvas },
} as const;
