"use client";

import type { AiSettings } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  defaultAiSettings,
  isAiConfigured,
  onAiSettingsChanged,
  whenAiSettingsReady,
} from "@/src/lib/ai-provider";
import {
  runAiBatches,
  type AiBatchContext,
  type AiBatchFailure,
} from "@/src/lib/ai-batch";

export type AiRunStatus =
  | "idle"
  | "running"
  | "done"
  | "partial"
  | "error"
  | "cancelled";

export interface AiRunState<TItem> {
  /** Characters received so far, the one sign of life a long batch gives off. */
  characters: number;
  /** Requests that came back, whether they were usable or not. */
  completed: number;
  error: string;
  failed: number;
  failures: AiBatchFailure[];
  /** Which requests of the original run failed, numbered as the user sees them. */
  failedSteps: number[];
  /** Requests sent and still waiting for a reply. */
  inFlight: number;
  items: TItem[];
  retrying: number;
  status: AiRunStatus;
  succeeded: number;
  total: number;
}

const initialState = <TItem,>(): AiRunState<TItem> => ({
  characters: 0,
  completed: 0,
  error: "",
  failed: 0,
  failedSteps: [],
  failures: [],
  inFlight: 0,
  items: [],
  retrying: 0,
  status: "idle",
  succeeded: 0,
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
  run: (batch: TBatch, context: AiBatchContext) => Promise<TItem[]>;
}) {
  const [state, setState] = useState<AiRunState<TItem>>(initialState<TItem>);
  const [settings, setSettings] = useState<AiSettings>(defaultAiSettings);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<TBatch[]>([]);
  // Step numbers as first shown to the user. A retry run only holds the batches
  // that failed, so without carrying these the second attempt would renumber
  // them and the panel would say 第 1 段 for what the user knows as 第 4 段.
  const pendingStepsRef = useRef<number[]>([]);
  const runRef = useRef(run);
  const mergeRef = useRef(merge);
  runRef.current = run;
  mergeRef.current = merge;

  useEffect(() => {
    let active = true;
    void whenAiSettingsReady().then((stored) => {
      if (active) setSettings(stored);
    });
    const unsubscribe = onAiSettingsChanged(setSettings);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const execute = useCallback(async (
    batches: TBatch[],
    previous: TItem[],
    steps: number[],
  ) => {
    if (!batches.length) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setState({
      ...initialState<TItem>(),
      items: previous,
      status: "running",
      total: batches.length,
    });

    const outcome = await runAiBatches<TBatch, TItem[]>({
      batches,
      onProgress: (progress) =>
        setState((current) =>
          current.status === "running"
            ? {
                ...current,
                characters: progress.characters,
                completed: progress.completed,
                failed: progress.failed,
                inFlight: progress.inFlight,
                retrying: progress.retrying,
                succeeded: progress.succeeded,
                total: progress.total,
              }
            : current,
        ),
      run: (batch, _index, context) => runRef.current(batch, context),
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      // Stopping means stopping: whatever came back mid-run is dropped rather
      // than half-applied, so the preview always matches one whole press.
      setState((current) => ({
        ...current,
        inFlight: 0,
        items: previous,
        retrying: 0,
        status: "cancelled",
      }));
      return;
    }

    const produced = outcome.results.flatMap((result) => result.value);
    const combined = [...previous, ...produced];
    const items = mergeRef.current ? mergeRef.current(combined) : combined;
    pendingRef.current = outcome.failures.map((failure) => batches[failure.index]);
    pendingStepsRef.current = outcome.failures.map(
      (failure) => steps[failure.index],
    );

    setState({
      characters: 0,
      failedSteps: pendingStepsRef.current,
      completed: outcome.results.length + outcome.failures.length,
      error:
        outcome.fatal || (items.length ? "" : (outcome.failures[0]?.message ?? "")),
      failed: outcome.failures.length,
      failures: outcome.failures,
      inFlight: 0,
      items,
      retrying: 0,
      status: outcome.fatal
        ? "error"
        : !outcome.failures.length
          ? "done"
          : items.length
            ? "partial"
            : "error",
      succeeded: outcome.results.length,
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
      pendingStepsRef.current = [];
      if (!batches.length) {
        setState({ ...initialState<TItem>(), items: seed, status: "done" });
        return;
      }
      void execute(
        batches,
        seed,
        batches.map((_batch, index) => index + 1),
      );
    },
    [execute],
  );

  const retryFailed = useCallback(() => {
    const batches = pendingRef.current;
    if (batches.length)
      void execute(batches, state.items, pendingStepsRef.current);
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
    /** The configured batch size, once settings have been read from storage. */
    batchSize: settings.batchSize,
    cancel,
    configured: isAiConfigured(settings),
    reset,
    retryFailed,
    setError,
    setItems,
    start,
    state,
  };
}
