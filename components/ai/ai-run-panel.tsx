"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import type { AiRunState } from "@/components/ai/use-ai-generation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { copyToClipboard } from "@/src/lib/clipboard";

/**
 * The single surface for running an AI generation.
 *
 * Calling the API is the primary path: one button, batched automatically, with
 * progress and partial results. The manual path is never removed, but it is not
 * a second button beside the first — it is one line of small text, so the panel
 * asks for a press rather than for a decision. Without a key configured it
 * opens by itself, because then it is the only path there is.
 */
export function AiRunPanel<TItem>({
  actionLabel,
  configured,
  localCount = 0,
  manualError,
  onCancel,
  onManualResponse,
  onRetryFailed,
  onStart,
  prompts,
  results,
  scopeSummary,
  state,
}: {
  actionLabel: string;
  configured: boolean;
  /** Items the caller already built locally, so no request covers them. */
  localCount?: number;
  manualError?: string;
  onCancel: () => void;
  onManualResponse: (response: string, batchIndex: number) => void;
  onRetryFailed: () => void;
  onStart: () => void;
  prompts: string[];
  results?: ReactNode;
  scopeSummary: string;
  state: AiRunState<TItem>;
}) {
  const [manualOpen, setManualOpen] = useState(!configured);
  const [manualIndex, setManualIndex] = useState(0);
  const [manualResponse, setManualResponse] = useState("");
  const [copied, setCopied] = useState(false);

  const batchCount = prompts.length;
  const running = state.status === "running";
  // When everything was built locally there is nothing to send, so the AI
  // set-up prompt and the manual paste box would both be asking for nothing.
  const needsAi = batchCount > 0;
  const step = Math.min(manualIndex, Math.max(batchCount - 1, 0));

  useEffect(() => {
    setManualIndex(0);
    setManualResponse("");
  }, [batchCount]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyPrompt = async () => {
    await copyToClipboard(prompts[step] ?? "");
    setCopied(true);
  };

  const submitManual = () => {
    onManualResponse(manualResponse, step);
    setManualResponse("");
    if (step < batchCount - 1) setManualIndex(step + 1);
  };

  return (
    <section className="rounded-[var(--radius-card)] border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{scopeSummary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {localCount > 0 && `${t("ai.builtLocally", { count: localCount })} · `}
            {batchCount === 0
              ? t("ai.noRequestNeeded")
              : batchCount > 1
                ? t("ai.batchPlan", { count: batchCount })
                : t("ai.singleRequest")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {running ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              <Icons.cancel />
              {t("ai.stop")}
            </Button>
          ) : configured || !needsAi ? (
            <Button type="button" disabled={!batchCount && !localCount} onClick={onStart}>
              <Icons.generate />
              {actionLabel}
            </Button>
          ) : (
            <Button asChild>
              <Link href="/me">
                <Icons.ai />
                {t("ai.setUp")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {needsAi && !running && !manualOpen && (
        <div className="px-4 pb-4 sm:px-5">
          <ManualToggle onClick={() => setManualOpen(true)} open={false} />
        </div>
      )}

      {running && (
        <div className="rule-t px-4 py-4 sm:px-5">
          <div
            aria-label={t("ai.progressLabel")}
            aria-valuemax={state.total}
            aria-valuemin={0}
            aria-valuenow={state.completed}
            className="h-1 overflow-hidden rounded-full bg-[var(--surface-inset)]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[var(--motion-control)] ease-[var(--ease-arrive)]"
              style={{
                width: `${state.total ? (state.completed / state.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2.5 text-xs tabular-nums text-muted-foreground">
            {t("ai.progress", {
              completed: state.completed,
              total: state.total,
            })}
          </p>
        </div>
      )}

      {!running && state.failures.length > 0 && (
        <div className="rule-t px-4 py-4 text-sm sm:px-5">
          <p className="font-medium text-destructive">
            {t("ai.someBatchesFailed", { count: state.failures.length })}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {state.failures[0]?.message}
          </p>
          <Button
            type="button"
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={onRetryFailed}
          >
            <Icons.retry />
            {t("ai.retryFailed", { count: state.failures.length })}
          </Button>
        </div>
      )}

      {!running && state.status === "cancelled" && (
        <p className="rule-t px-4 py-4 text-sm text-muted-foreground sm:px-5">
          {t("ai.stopped")}
        </p>
      )}

      {manualOpen && needsAi && (
        <div className="t-panel-reveal rule-t px-4 py-5 sm:px-5">
          <p className="type-lead">
            {t("ai.manualDescription")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyPrompt()}>
              {copied ? <Icons.success /> : <Icons.copy />}
              {batchCount > 1
                ? t(copied ? "ai.copiedStep" : "ai.copyStep", {
                    step: step + 1,
                    total: batchCount,
                  })
                : t(copied ? "ai.copied" : "ai.copyPrompt")}
            </Button>
            {batchCount > 1 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("ai.stepPosition", { step: step + 1, total: batchCount })}
              </span>
            )}
          </div>
          <Field className="mt-4" label={t("ai.manualResponse")}>
            <Textarea
              className="min-h-36 font-mono text-xs leading-5"
              value={manualResponse}
              onChange={(event) => setManualResponse(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            disabled={!manualResponse.trim()}
            onClick={submitManual}
          >
            <Icons.success />
            {batchCount > 1
              ? t("ai.applyStep", { step: step + 1 })
              : t("ai.validate")}
          </Button>
          {manualError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {manualError}
            </p>
          )}
          <p className="mt-5">
            <ManualToggle onClick={() => setManualOpen(false)} open />
          </p>
        </div>
      )}

      {results && <div className="rule-t px-4 py-5 sm:px-5">{results}</div>}
    </section>
  );
}

function ManualToggle({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      aria-expanded={open}
      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={onClick}
      type="button"
    >
      {t(open ? "ai.manualClose" : "ai.manualPath")}
    </button>
  );
}
