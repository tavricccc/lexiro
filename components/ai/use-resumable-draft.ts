"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DraftStatus = "checking" | "offer" | "invalid" | "active";

/** A new, versioned local draft. Older flows did not persist drafts. */
export function useResumableDraft<T extends object>(key: string, initial: T) {
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const draftRef = useRef(initial);
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState<T | null>(null);
  const [status, setStatus] = useState<DraftStatus>("checking");

  useEffect(() => {
    setStatus("checking");
    draftRef.current = initialRef.current;
    setDraft(initialRef.current);
    setPending(null);
    const raw = localStorage.getItem(key);
    if (!raw) {
      setStatus("active");
      return;
    }
    try {
      const stored: unknown = JSON.parse(raw);
      if (
        !stored ||
        typeof stored !== "object" ||
        !("schemaVersion" in stored) ||
        stored.schemaVersion !== 1 ||
        !("value" in stored) ||
        !stored.value ||
        typeof stored.value !== "object"
      ) {
        setStatus("invalid");
        return;
      }
      setPending(stored.value as T);
      setStatus("offer");
    } catch {
      setStatus("invalid");
    }
  }, [key]);

  const update = useCallback((patch: Partial<T>) => {
    const next = { ...draftRef.current, ...patch };
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, value: next }));
    draftRef.current = next;
    setDraft(next);
  }, [key]);

  const resume = useCallback(() => {
    const saved = pending!;
    draftRef.current = saved;
    setDraft(saved);
    setPending(null);
    setStatus("active");
  }, [pending]);

  const restart = useCallback(() => {
    localStorage.removeItem(key);
    draftRef.current = initialRef.current;
    setDraft(initialRef.current);
    setPending(null);
    setStatus("active");
  }, [key]);

  const clear = useCallback(() => localStorage.removeItem(key), [key]);

  return { draft, pending, status, update, resume, restart, clear };
}
