"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiSettings, AiTask, AiPhase, AiUsage } from "@/src/types/ai";
import {
  defaultAiSettings,
  isAiConfigured,
  onAiSettingsChanged,
  whenAiSettingsReady,
} from "@/src/lib/ai-provider";
import { createAiSession, resetConversation } from "@/src/lib/ai/session";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { t } from "@/lib/i18n";

export type AiRunStatus = "idle" | "running" | "done" | "error" | "cancelled";
export interface AiRunState<T> {
  status: AiRunStatus;
  phase: AiPhase;
  characters: number;
  completed: number;
  total: number;
  segments: number;
  error: string;
  items: T[];
  usage: AiUsage;
  notices: string[];
  model: string;
  startedAt: number | null;
  elapsedMs: number;
  remaining: number;
}
const initialState = <T>(): AiRunState<T> => ({
  status: "idle",
  phase: "connecting",
  characters: 0,
  completed: 0,
  total: 0,
  segments: 0,
  error: "",
  items: [],
  usage: {},
  notices: [],
  model: "",
  startedAt: null,
  elapsedMs: 0,
  remaining: 0,
});

export function useAiGeneration<T>({
  merge,
}: { merge?: (items: T[]) => T[] } = {}) {
  const [state, setState] = useState<AiRunState<T>>(initialState<T>);
  const [settings, setSettings] = useState<AiSettings>(defaultAiSettings);
  const [ready, setReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef<AiRun<T> | null>(null);
  const generationId = useRef(0);
  const mergeRef = useRef(merge);
  mergeRef.current = merge;

  useEffect(() => {
    let active = true;
    void whenAiSettingsReady()
      .then((value) => {
        if (active) {
          setSettings(value);
          setReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setState((s) => ({
            ...s,
            status: "error",
            error:
              reason instanceof Error
                ? reason.message
                : t("ai.invalidSettings"),
          }));
      });
    const off = onAiSettingsChanged((value) => {
      setSettings(value);
      setReady(true);
    });
    return () => {
      active = false;
      off();
      generationId.current++;
      abortRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async (run: AiRun<T>) => {
    abortRef.current?.abort();
    const controller = new AbortController(),
      id = ++generationId.current,
      start = Date.now();
    abortRef.current = controller;
    setState((s) => ({
      ...s,
      status: "running",
      error: "",
      startedAt: start,
      model: run.session.settings.model,
      items: [...run.items],
      completed: run.completed,
      total: run.total,
      remaining: run.pending.length,
      usage: { ...run.session.usage },
    }));
    try {
      await runTask(run, {
        signal: controller.signal,
        merge: mergeRef.current,
        onUpdate: (update) => {
          if (id === generationId.current)
            setState((s) => ({
              ...s,
              ...update,
              remaining: run.pending.length,
            }));
        },
      });
      if (id === generationId.current)
        setState((s) => ({
          ...s,
          status: "done",
          startedAt: null,
          elapsedMs: s.elapsedMs + Date.now() - start,
          remaining: 0,
        }));
    } catch (reason) {
      if (id === generationId.current)
        setState((s) => ({
          ...s,
          status: controller.signal.aborted ? "cancelled" : "error",
          startedAt: null,
          elapsedMs: s.elapsedMs + Date.now() - start,
          remaining: run.pending.length,
          error: controller.signal.aborted
            ? ""
            : reason instanceof Error
              ? reason.message
              : t("ai.invalidReply"),
        }));
    } finally {
      if (id === generationId.current) abortRef.current = null;
    }
  }, []);

  const start = useCallback(
    (task: AiTask<T>, seed: T[] = []) => {
      if (!ready) return;
      const run: AiRun<T> = {
        task,
        // Always cached, however few segments the task has. A cache write
        // pays for itself on the second request sharing the prefix, and a
        // task reaches that from a validation repair, a retry, another round
        // or a regenerate — all of which keep the same instructions.
        session: createAiSession(settings, task.context),
        pending: [...task.steps],
        items: [...seed],
        completed: seed.length,
        total: seed.length + task.steps.reduce((n, s) => n + s.count, 0),
        segments: 0,
      };
      runRef.current = run;
      setState(initialState<T>());
      void execute(run);
    },
    [execute, ready, settings],
  );
  const resume = useCallback(() => {
    if (!abortRef.current && runRef.current?.pending.length)
      void execute(runRef.current);
  }, [execute]);
  const append = useCallback(
    (task?: AiTask<T>) => {
      const run = runRef.current;
      if (!run || abortRef.current || run.pending.length) return;
      if (task) {
        run.task = task;
        if (run.session.context !== task.context) {
          run.session.context = task.context;
          resetConversation(run.session);
        }
      }
      run.session.cache = true;
      const round = run.segments + 1;
      run.pending = run.task.steps.map((step) => ({
        ...step,
        id: `${step.id}-round-${round}`,
        prompt: `${step.prompt}\n這次是追加新的一版：使用不同語境，不可重複先前生成的句子、文章或題目。`,
      }));
      run.total += run.pending.reduce((n, s) => n + s.count, 0);
      void execute(run);
    },
    [execute],
  );
  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    generationId.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    runRef.current = null;
    setState(initialState<T>());
  }, []);
  const setItems = useCallback(
    (items: T[], total = items.length) =>
      setState((s) => ({
        ...s,
        items,
        status: "done",
        error: "",
        completed: items.length,
        total,
        segments: s.segments + 1,
      })),
    [],
  );
  return {
    state,
    settings,
    ready,
    enabled: settings.enabled,
    configured: isAiConfigured(settings),
    batchSize: settings.batchSize,
    start,
    resume,
    append,
    cancel,
    reset,
    setItems,
  };
}
