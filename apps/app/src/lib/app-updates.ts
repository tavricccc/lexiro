import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { Appearance, AppState } from "react-native";

import { DURATION } from "@/components/ui/motion";
import { plain } from "@/lib/theme";

/** How often a foregrounded app asks for a newer JS bundle. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/**
 * A downloaded update is applied when the app returns after this long away,
 * so the reload reads like a fresh launch and the stores finished flushing
 * when it went to the background.
 */
const APPLY_AFTER_AWAY_MS = 10 * 60 * 1000;

/** How long a launch waits to hear whether there is a newer version. */
const CHECK_LIMIT_MS = 5_000;
/** How long a launch waits for that version to download. */
const DOWNLOAD_LIMIT_MS = 30_000;

/** Restarts into the downloaded update behind a plain canvas that fades away. */
export function applyUpdate() {
  const dark = Appearance.getColorScheme() === "dark";
  return Updates.reloadAsync({
    reloadScreenOptions: {
      backgroundColor: dark ? plain.canvas.dark : plain.canvas.light,
      spinner: { enabled: false },
      fade: true,
    },
  });
}

/**
 * The launch's own update: expo-updates checks and downloads on every cold
 * start (checkAutomatically ON_LOAD); the app waits for it, then restarts into
 * what it got. Offline, on an error or past the limits the app opens as it is,
 * and a download that finishes later is applied by `useAppUpdates`.
 */
export function useLaunchUpdate() {
  const { isStartupProcedureRunning, isDownloading, isUpdateAvailable, isUpdatePending, downloadProgress } =
    Updates.useUpdates();
  const [done, setDone] = useState(__DEV__ || !Updates.isEnabled);
  const updating = isUpdateAvailable || isDownloading || isUpdatePending;

  if (!done && !isStartupProcedureRunning && !isDownloading && !isUpdatePending) setDone(true);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setDone(true), updating ? DOWNLOAD_LIMIT_MS : CHECK_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [done, updating]);

  useEffect(() => {
    if (done || !isUpdatePending) return;
    // Long enough for the bar to be seen reaching its end.
    const timer = setTimeout(() => {
      applyUpdate().catch(() => setDone(true));
    }, DURATION.morph);
    return () => clearTimeout(timer);
  }, [done, isUpdatePending]);

  return { done, updating, progress: isUpdatePending ? 1 : (downloadProgress ?? 0) };
}

/**
 * iOS keeps the app alive for days, so this also checks on returning to the
 * foreground and applies a downloaded update after a long absence.
 */
export function useAppUpdates() {
  // Set by the launch check as well as by the foreground checks below.
  const { isUpdatePending } = Updates.useUpdates();
  const pending = useRef(isUpdatePending);
  useEffect(() => {
    pending.current = isUpdatePending;
  }, [isUpdatePending]);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let lastCheck = Date.now();
    let backgroundedAt: number | null = null;
    let checking = false;

    const fetchNewer = async () => {
      if (checking || pending.current) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the server is unreachable; the next foreground retries.
      } finally {
        checking = false;
      }
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        backgroundedAt = Date.now();
        return;
      }
      if (state !== "active") return;
      const away = backgroundedAt === null ? 0 : Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (pending.current && away >= APPLY_AFTER_AWAY_MS) {
        void applyUpdate();
        return;
      }
      if (Date.now() - lastCheck >= CHECK_INTERVAL_MS) void fetchNewer();
    });
    return () => subscription.remove();
  }, []);
}
