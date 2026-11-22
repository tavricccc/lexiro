import { DynamicColorIOS, Platform, type ColorValue } from "react-native";

/**
 * Light/dark dynamic color pair resolved natively on iOS so static styles
 * respond to Appearance changes without re-rendering every tree.
 */
function pair(light: string, dark: string): ColorValue {
  if (Platform.OS === "ios") return DynamicColorIOS({ light, dark });
  return light;
}

/**
 * Lexiro v2 palette — flat, quiet canvas with white cards, pine green accent,
 * honey highlight (streaks & stars), and ink hero cards.
 */
export const PINE_LIGHT = "#1f7a5c";
export const PINE_DARK = "#7fdcb4";

export const plain = {
  canvas: { light: "#f2f3f0", dark: "#0c0f0d" },
  surface: { light: "#ffffff", dark: "#141b17" },
  ink: { light: "#111512", dark: "#eef3f0" },
  inkMuted: { light: "#56645d", dark: "#a3b0a9" },
  inkFaint: { light: "#8b9690", dark: "#6d7a73" },
  contrast: { light: PINE_LIGHT, dark: PINE_DARK },
  onContrast: { light: "#ffffff", dark: "#062016" },
  highlight: { light: "#e0a12a", dark: "#f4c060" },
  positive: { light: "#1f9d55", dark: "#5fd394" },
  positiveInk: { light: "#12703a", dark: "#7fe3aa" },
  danger: { light: "#d2445f", dark: "#ff7f95" },
  dangerInk: { light: "#b0263f", dark: "#ff9aab" },
  caution: { light: "#b97a12", dark: "#eab765" },
  info: { light: "#2f7fd8", dark: "#6fb0ff" },
} as const;

export const colors = {
  canvas: pair(plain.canvas.light, plain.canvas.dark),
  surface: pair(plain.surface.light, plain.surface.dark),
  surfaceSolid: pair("#ffffff", "#18201b"),
  surfaceRaised: pair("rgba(17,38,30,0.05)", "rgba(255,255,255,0.06)"),
  surfacePressed: pair("rgba(17,38,30,0.09)", "rgba(255,255,255,0.10)"),
  line: pair("rgba(17,38,30,0.09)", "rgba(255,255,255,0.09)"),

  ink: pair(plain.ink.light, plain.ink.dark),
  inkMuted: pair(plain.inkMuted.light, plain.inkMuted.dark),
  inkFaint: pair(plain.inkFaint.light, plain.inkFaint.dark),

  // Brand pine green
  contrast: pair(plain.contrast.light, plain.contrast.dark),
  onContrast: pair(plain.onContrast.light, plain.onContrast.dark),
  accentSoft: pair("rgba(31,122,92,0.11)", "rgba(127,220,180,0.14)"),
  accentInk: pair("#176348", "#9be6c5"),

  // Semantic accents
  highlight: pair(plain.highlight.light, plain.highlight.dark),
  highlightSoft: pair("rgba(224,161,42,0.15)", "rgba(244,192,96,0.16)"),
  positive: pair(plain.positive.light, plain.positive.dark),
  positiveInk: pair(plain.positiveInk.light, plain.positiveInk.dark),
  positiveSoft: pair("rgba(31,157,85,0.12)", "rgba(95,211,148,0.14)"),
  danger: pair(plain.danger.light, plain.danger.dark),
  dangerInk: pair(plain.dangerInk.light, plain.dangerInk.dark),
  dangerSoft: pair("rgba(210,68,95,0.11)", "rgba(255,127,149,0.14)"),
  caution: pair(plain.caution.light, plain.caution.dark),
  cautionSoft: pair("rgba(185,122,18,0.14)", "rgba(234,183,101,0.16)"),
  info: pair(plain.info.light, plain.info.dark),
  infoSoft: pair("rgba(47,127,216,0.12)", "rgba(111,176,255,0.15)"),

  // Ink hero card (dark in light mode, light in dark mode — matches web `bg-ink text-canvas`)
  heroBg: pair("#111512", "#eef3f0"),
  heroText: pair("#f2f3f0", "#0c0f0d"),
  heroMuted: pair("rgba(242,243,240,0.65)", "rgba(12,15,13,0.62)"),
  heroFaint: pair("rgba(242,243,240,0.45)", "rgba(12,15,13,0.42)"),
  heroTrack: pair("rgba(242,243,240,0.14)", "rgba(12,15,13,0.14)"),
  heroButtonBg: pair("#f2f3f0", "#0c0f0d"),
  heroButtonText: pair("#111512", "#eef3f0"),
  heroGhostBg: pair("rgba(242,243,240,0.13)", "rgba(12,15,13,0.11)"),
} as const;

export const radius = {
  chip: 10,
  tile: 16,
  control: 18,
  card: 24,
  hero: 30,
  pill: 999,
} as const;

export const space = {
  gutter: 16,
  section: 24,
  block: 14,
  row: 16,
} as const;

/**
 * Albert Sans renders English headwords, scores, and counts; CJK stays in the
 * system UI font (PingFang TC on iOS). Each weight is its own family.
 */
export const fonts = {
  "AlbertSans-500": require("../../assets/fonts/AlbertSans-500.ttf"),
  "AlbertSans-600": require("../../assets/fonts/AlbertSans-600.ttf"),
  "AlbertSans-700": require("../../assets/fonts/AlbertSans-700.ttf"),
  "AlbertSans-800": require("../../assets/fonts/AlbertSans-800.ttf"),
};

export const latin = {
  medium: { fontFamily: "AlbertSans-500" },
  semibold: { fontFamily: "AlbertSans-600" },
  bold: { fontFamily: "AlbertSans-700" },
  heavy: { fontFamily: "AlbertSans-800" },
} as const;

/** Returns true when text contains Latin letters (matches web `isLatin`). */
export function hasLatin(text: string | undefined): boolean {
  return Boolean(text && /[A-Za-z]/.test(text));
}

export const type = {
  heroNumber: { ...latin.bold, fontSize: 64, lineHeight: 68, letterSpacing: -2.5 },
  display: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  section: { fontSize: 15, fontWeight: "600" as const, letterSpacing: -0.1 },
  row: { fontSize: 16, fontWeight: "500" as const },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 18 },
} as const;

/** Plain strings for Reanimated color interpolation & native options. */
export function hexPalette(dark: boolean) {
  return dark
    ? {
        canvas: plain.canvas.dark,
        surface: plain.surface.dark,
        ink: plain.ink.dark,
        inkMuted: plain.inkMuted.dark,
        contrast: plain.contrast.dark,
        onContrast: plain.onContrast.dark,
        highlight: plain.highlight.dark,
        positive: plain.positive.dark,
        danger: plain.danger.dark,
      }
    : {
        canvas: plain.canvas.light,
        surface: plain.surface.light,
        ink: plain.ink.light,
        inkMuted: plain.inkMuted.light,
        contrast: plain.contrast.light,
        onContrast: plain.onContrast.light,
        highlight: plain.highlight.light,
        positive: plain.positive.light,
        danger: plain.danger.light,
      };
}
