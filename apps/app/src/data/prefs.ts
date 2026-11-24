import { useEffect } from "react";
import { Appearance } from "react-native";

import type { Prefs } from "@/core/contract";
import { syncStorage } from "@/platform/install";
import { api } from "./api";
import { keys, queryClient, usePrefs } from "./queries";

const THEME_KEY = "lexiro:theme";

export function applyTheme(theme: Prefs["theme"]) {
  if (theme === "system") syncStorage.removeItem(THEME_KEY);
  else syncStorage.setItem(THEME_KEY, theme);
  Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
}

/** Restores the persisted theme preference at startup before network prefs arrive. */
export function restoreTheme() {
  const saved = syncStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    Appearance.setColorScheme(saved);
  } else {
    Appearance.setColorScheme("unspecified");
  }
}

export async function savePrefs(change: Partial<Prefs>): Promise<Prefs> {
  const current = queryClient.getQueryData<Prefs>(keys.prefs) ?? (await api<Prefs>("/prefs"));
  const next = { ...current, ...change };
  if (change.theme) applyTheme(change.theme);
  queryClient.setQueryData(keys.prefs, next);
  try {
    const saved = await api<Prefs>("/prefs", { method: "PUT", json: next });
    queryClient.setQueryData(keys.prefs, saved);
    return saved;
  } catch (error) {
    queryClient.setQueryData(keys.prefs, current);
    if (change.theme) applyTheme(current.theme);
    throw error;
  }
}

/** Keeps native color scheme in sync with account prefs from other devices. */
export function useThemeSync() {
  const theme = usePrefs().data?.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
}
