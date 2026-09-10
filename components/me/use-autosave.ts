"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved";

/**
 * Settings save themselves.
 *
 * The settings page used to mix three behaviours on one screen — theme applied
 * instantly, goals needed a "save goals" button, AI needed another one — so
 * whether a change had stuck depended on which row it was in. Everything now
 * commits a moment after the last keystroke and reports it in one place.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void> | void,
  { delay = 700, ready = true }: { delay?: number; ready?: boolean } = {},
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const saved = useRef<string | null>(null);
  const latest = useRef({ save, value });
  latest.current = { save, value };

  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (!ready) return;
    // The first value seen after hydration is what is already stored.
    if (saved.current === null) {
      saved.current = serialized;
      return;
    }
    if (saved.current === serialized) return;

    const timer = setTimeout(() => {
      saved.current = serialized;
      setStatus("saving");
      void Promise.resolve(latest.current.save(latest.current.value)).then(() =>
        setStatus("saved"),
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, ready, serialized]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2400);
    return () => clearTimeout(timer);
  }, [status]);

  return status;
}
