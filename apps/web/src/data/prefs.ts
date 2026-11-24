import { useEffect } from "react";
import type { Prefs } from "@lexiro/contract";
import { api } from "./api";
import { keys, queryClient, usePrefs } from "./queries";

const THEME_KEY = "lexiro:theme";

/** Saves the theme on this device too, so the page paints in it before the account loads. */
export function applyTheme(theme: Prefs["theme"]) {
  if ((localStorage.getItem(THEME_KEY) ?? "system") === theme) return;
  if (theme === "system") localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new Event("lexiro:theme"));
}

export async function savePrefs(change: Partial<Prefs>): Promise<Prefs> {
  const current = queryClient.getQueryData<Prefs>(keys.prefs) ?? await api<Prefs>("/prefs");
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

/** Follows the account's theme when it arrives or changes on another device. */
export function useThemeSync() {
  const theme = usePrefs().data?.theme;
  useEffect(() => { if (theme) applyTheme(theme); }, [theme]);
}
