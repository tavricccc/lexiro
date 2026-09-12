"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Tier } from "@lexiro/ai-contract";
import type { AiTask, AiPhase } from "@/src/types/ai";
import { createAiSession, resetConversation } from "@/src/lib/ai/session";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { useCloudStore } from "@/stores/cloud-store";
import { t } from "@/lib/i18n";

export type AiRunStatus = "idle" | "running" | "done" | "error" | "cancelled";
export interface AiRunState<T> {
  status: AiRunStatus; phase: AiPhase; characters: number; completed: number; total: number;
  segments: number; error: string; items: T[]; notices: string[]; startedAt: number | null;
  elapsedMs: number; remaining: number;
}
const initialState = <T>(): AiRunState<T> => ({ status: "idle", phase: "connecting", characters: 0, completed: 0, total: 0, segments: 0, error: "", items: [], notices: [], startedAt: null, elapsedMs: 0, remaining: 0 });

export function useAiGeneration<T>({ merge }: { merge?: (items: T[]) => T[] } = {}) {
  const [state, setState] = useState<AiRunState<T>>(initialState<T>);
  const [tier, setTier] = useState<Tier>("lite");
  const ready = useCloudStore((store) => store.ready);
  const uid = useCloudStore((store) => store.user?.uid);
  const abortRef = useRef<AbortController | null>(null), runRef = useRef<AiRun<T> | null>(null), generationId = useRef(0);
  const mergeRef = useRef(merge); mergeRef.current = merge;
  useEffect(() => {
    runRef.current = null; setState(initialState<T>());
    return () => { generationId.current++; abortRef.current?.abort(); abortRef.current = null; };
  }, [uid]);
  const execute = useCallback(async (run: AiRun<T>) => {
    abortRef.current?.abort();
    const controller = new AbortController(), id = ++generationId.current, start = Date.now();
    abortRef.current = controller;
    setState((s) => ({ ...s, status: "running", error: "", startedAt: start, items: [...run.items], completed: run.completed, total: run.total, remaining: run.pending.length }));
    try {
      await runTask(run, { signal: controller.signal, merge: mergeRef.current, onUpdate: (update) => {
        if (id === generationId.current) setState((s) => ({ ...s, ...update, remaining: run.pending.length }));
      } });
      if (id === generationId.current) setState((s) => ({ ...s, status: "done", startedAt: null, elapsedMs: s.elapsedMs + Date.now() - start, remaining: 0 }));
    } catch (reason) {
      if (id === generationId.current) setState((s) => ({ ...s, status: controller.signal.aborted ? "cancelled" : "error", startedAt: null, elapsedMs: s.elapsedMs + Date.now() - start, remaining: run.pending.length, error: controller.signal.aborted ? "" : reason instanceof Error ? reason.message : t("ai.invalidReply") }));
    } finally { if (id === generationId.current) abortRef.current = null; }
  }, []);
  const start = useCallback((task: AiTask<T>, seed: T[] = []) => {
    if (!ready || (task.steps.length && !uid)) { setState((s) => ({ ...s, status: "error", error: t("managed.signInRequired") })); return; }
    const run: AiRun<T> = { task, session: createAiSession(tier, task.context), pending: [...task.steps], items: [...seed], completed: seed.length, total: seed.length + task.steps.reduce((n,s) => n+s.count,0), segments: 0 };
    runRef.current = run; setState(initialState<T>()); void execute(run);
  }, [execute, ready, uid, tier]);
  const resume = useCallback(() => { if (!abortRef.current && runRef.current?.pending.length) void execute(runRef.current); }, [execute]);
  const append = useCallback((task?: AiTask<T>) => {
    const run = runRef.current;
    if (!run || abortRef.current || run.pending.length) return;
    if (task) run.task = task;
    if (run.session.context !== run.task.context || run.session.tier !== tier) resetConversation(run.session);
    run.session.context = run.task.context; run.session.tier = tier;
    run.session.sessionId = crypto.randomUUID(); run.session.append = true;
    run.pending = [...run.task.steps]; run.total += run.pending.reduce((n,s) => n+s.count,0);
    void execute(run);
  }, [execute, tier]);
  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => { generationId.current++; abortRef.current?.abort(); abortRef.current = null; runRef.current = null; setState(initialState<T>()); }, []);
  const setItems = useCallback((items: T[]) => {
    if (runRef.current) runRef.current.items = [...items];
    setState((s) => ({ ...s, items }));
  }, []);
  return { state, ready, configured: Boolean(uid && process.env.NEXT_PUBLIC_AI_WORKER_URL), batchSize: 20, tier, setTier, start, resume, append, cancel, reset, setItems };
}
