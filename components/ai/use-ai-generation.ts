"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isAiConfigured,
  onAiSettingsChanged,
  whenAiSettingsReady,
} from "@/src/lib/ai-provider";
import { runAiBatches, type AiBatchFailure } from "@/src/lib/ai-batch";

export type AiRunStatus =
  | "idle"
  | "running"
  | "done"
  | "partial"
  | "error"
  | "cancelled";

export interface AiRunState<TItem> {
  error: string;
  failures: AiBatchFailure[];
  items: TItem[];
  status: AiRunStatus;
  total: number;
  completed: number;
}

const initialState = <TItem,>(): AiRunState<TItem> => ({
  completed: 0,
  error: "",
  failures: [],
  items: [],
  status: "idle",
  total: 0,
});

/**
 * Drives a batched AI generation: splits the work, runs several requests at a
 * time, reports progress, and keeps whatever succeeded when some batches fail.
 *
 * `run` produces the items for one batch. `merge` gets every item from every
 * successful batch and returns the final list, which is where callers dedupe.
 */
export function useAiGeneration<TBatch, TItem>({
  merge,
  run,
}: {
  merge?: (items: TItem[]) => TItem[];
  run: (batch: TBatch, signal?: AbortSignal) => Promise<TItem[]>;
}) {
  const [state, setState] = useState<AiRunState<TItem>>(initialState<TItem>);
  const [configured, setConfigured] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<TBatch[]>([]);
  const runRef = useRef(run);
  const mergeRef = useRef(merge);
  runRef.current = run;
  mergeRef.current = merge;

  useEffect(() => {
    let active = true;
    void whenAiSettingsReady().then((settings) => {
      if (active) setConfigured(isAiConfigured(settings));
    });
    const unsubscribe = onAiSettingsChanged((settings) =>
      setConfigured(isAiConfigured(settings)),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const execute = useCallback(async (batches: TBatch[], previous: TItem[]) => {
    if (!batches.length) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setState({
      completed: 0,
      error: "",
      failures: [],
      items: previous,
      status: "running",
      total: batches.length,
    });

    const outcome = await runAiBatches<TBatch, TItem[]>({
      batches,
      onProgress: (progress) =>
        setState((current) =>
          current.status === "running"
            ? { ...current, completed: progress.completed, total: progress.total }
            : current,
        ),
      run: (batch, _index, signal) => runRef.current(batch, signal),
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      setState((current) => ({ ...current, status: "cancelled" }));
      return;
    }

    const produced = outcome.results.flatMap((result) => result.value);
    const combined = [...previous, ...produced];
    const items = mergeRef.current ? mergeRef.current(combined) : combined;
    pendingRef.current = outcome.failures.map((failure) => batches[failure.index]);

    setState({
      completed: batches.length,
      error: items.length ? "" : (outcome.failures[0]?.message ?? ""),
      failures: outcome.failures,
      items,
      status: !outcome.failures.length
        ? "done"
        : items.length
          ? "partial"
          : "error",
      total: batches.length,
    });
  }, []);

  /**
   * `seed` is for items the caller already built without a request — they show
   * up alongside the generated ones and survive a failed batch.
   */
  const start = useCallback(
    (batches: TBatch[], seed: TItem[] = []) => {
      pendingRef.current = [];
      if (!batches.length) {
        setState({
          completed: 0,
          error: "",
          failures: [],
          items: seed,
          status: "done",
          total: 0,
        });
        return;
      }
      void execute(batches, seed);
    },
    [execute],
  );

  const retryFailed = useCallback(() => {
    const batches = pendingRef.current;
    if (batches.length) void execute(batches, state.items);
  }, [execute, state.items]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    pendingRef.current = [];
    setState(initialState<TItem>());
  }, []);

  const setItems = useCallback((items: TItem[]) => {
    setState((current) => ({
      ...current,
      error: "",
      items,
      status: items.length ? "done" : current.status,
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((current) => ({ ...current, error, items: [], status: "error" }));
  }, []);

  return {
    cancel,
    configured,
    reset,
    retryFailed,
    setError,
    setItems,
    start,
    state,
  };
}
