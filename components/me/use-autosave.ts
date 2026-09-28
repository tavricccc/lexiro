"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";
type SaveJob<T> = {
  value: T;
  serialized: string;
  save: (value: T) => Promise<void> | void;
  revision: number;
};

export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void> | void,
  { delay = 700, ready = true }: { delay?: number; ready?: boolean } = {},
) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const saved = useRef<string | null>(null);
  const pending = useRef<SaveJob<T> | null>(null);
  const revision = useRef(0);
  const inFlight = useRef(0);
  const mounted = useRef(false);
  const latest = useRef({ save, value });
  latest.current = { save, value };
  const serialized = JSON.stringify(value);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const flush = useCallback(() => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    inFlight.current++;
    void Promise.resolve()
      .then(() => job.save(job.value))
      .then(
        () => {
          saved.current = job.serialized;
          if (mounted.current && job.revision === revision.current)
            setStatus("saved");
        },
        () => {
          if (mounted.current && job.revision === revision.current)
            setStatus("error");
        },
      )
      .finally(() => {
        inFlight.current--;
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    window.addEventListener("pagehide", flush);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (!ready) return;
    if (saved.current === null) {
      saved.current = serialized;
      return;
    }
    if (saved.current === serialized && !pending.current && !inFlight.current)
      return;
    pending.current = {
      ...latest.current,
      serialized,
      revision: ++revision.current,
    };
    setStatus("saving");
    const timer = setTimeout(flush, delay);
    // A new edit replaces the pending value; only leaving the page flushes it.
    return () => clearTimeout(timer);
  }, [delay, ready, serialized, retryCount, flush]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2400);
    return () => clearTimeout(timer);
  }, [status]);
  return { status, retry };
}
