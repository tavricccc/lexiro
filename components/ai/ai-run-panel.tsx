"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { AiRunState } from "./use-ai-generation";
import { AiManualPanel } from "./ai-manual-panel";
import { AiUsage } from "./ai-usage";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function AiRunPanel<T>({
  actionLabel,
  configured,
  enabled,
  ready,
  localCount = 0,
  manualError,
  onCancel,
  onManualResponse,
  onResume,
  onStart,
  onAppend,
  prompts,
  results,
  scopeSummary,
  state,
  unit,
}: {
  actionLabel: string;
  configured: boolean;
  enabled: boolean;
  ready: boolean;
  localCount?: number;
  manualError?: string;
  onCancel: () => void;
  onManualResponse: (response: string, index: number) => boolean;
  onResume: () => void;
  onStart: () => void;
  onAppend?: () => void;
  prompts: string[];
  results?: ReactNode;
  scopeSummary: string;
  state: AiRunState<T>;
  unit: string;
}) {
  const [now, setNow] = useState(0);
  const running = state.status === "running",
    started = state.status !== "idle",
    done = state.status === "done";
  const manual = ready && !enabled,
    canRun = ready && (configured || !prompts.length);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const seconds = Math.floor(
    (state.elapsedMs +
      (state.startedAt ? Math.max(0, now - state.startedAt) : 0)) /
      1000,
  );
  const title =
    manual && started && state.completed < state.total
      ? t("ai.awaitingManual")
      : running
        ? t(`ai.${state.phase}`)
        : done
          ? t("ai.done")
          : state.status === "cancelled"
            ? t("ai.paused")
            : state.status === "error"
              ? t("ai.needsAttention")
              : t("ai.ready");
  const percent = state.total
    ? Math.min(100, (state.completed / state.total) * 100)
    : done
      ? 100
      : 0;
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary",
              state.status === "error" && "bg-destructive/10 text-destructive",
            )}
          >
            {done ? (
              <Icons.success className="size-5" />
            ) : (
              <Icons.ai
                className={cn("size-5", running && "motion-safe:animate-pulse")}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{scopeSummary}</p>
            <h3
              className="mt-1 text-base font-semibold"
              aria-live="polite"
              aria-atomic="true"
            >
              {!ready ? t("ai.loadingSettings") : title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {manual
                ? t("ai.manualDescription")
                : started
                  ? t("ai.contextHint")
                  : t("ai.readyDescription")}
            </p>
          </div>
        </div>
        {started && (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p
                className="text-sm font-medium tabular-nums"
                aria-live="polite"
              >
                {t("ai.completedItems", {
                  completed: state.completed,
                  total: state.total,
                  unit,
                })}
              </p>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("ai.elapsed", { seconds })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t("ai.progressLabel")}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, state.total)}
              aria-valuenow={state.completed}
              className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-inset)]"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {t("ai.completedSegments", { count: state.segments })}
              </span>
              {running && state.characters > 0 && (
                <span className="tabular-nums">
                  {t("ai.progressCharacters", {
                    count: state.characters.toLocaleString(),
                  })}
                </span>
              )}
            </div>
          </div>
        )}
        {localCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("ai.builtLocally", { count: localCount })}
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm leading-6 text-destructive"
          >
            {state.error}
          </p>
        )}
        {ready && enabled && !configured && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("ai.incompleteSetup")}{" "}
            <Link
              href="/me"
              className="text-primary underline underline-offset-4"
            >
              {t("ai.setup")}
            </Link>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {running ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              <Icons.cancel />
              {t("ai.stop")}
            </Button>
          ) : (
            <>
              {state.remaining > 0 && canRun && (
                <Button type="button" onClick={onResume}>
                  <Icons.retry />
                  {t(
                    state.status === "error" ? "ai.retryCurrent" : "ai.resume",
                  )}
                </Button>
              )}
              {(!manual || !prompts.length) && (
                <Button
                  type="button"
                  variant={started ? "outline" : "default"}
                  disabled={!canRun || (!prompts.length && !localCount)}
                  onClick={onStart}
                >
                  <Icons.generate />
                  {started ? t("ai.regenerate") : actionLabel}
                </Button>
              )}
              {done && onAppend && configured && (
                <Button type="button" variant="secondary" onClick={onAppend}>
                  <Icons.create />
                  {t("ai.append")}
                </Button>
              )}
            </>
          )}
        </div>
        {started && (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {running ? t("ai.keepWorking") : t("ai.keptResults")}
          </p>
        )}
        {started && !running && !manual && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("ai.regenerateHint")}
            {done && onAppend ? ` ${t("ai.appendHint")}` : ""}
          </p>
        )}
      </div>
      {manual && prompts.length > 0 && (
        <AiManualPanel
          prompts={prompts}
          onResponse={onManualResponse}
          error={manualError}
        />
      )}
      {started && state.model && (
        <AiUsage
          usage={state.usage}
          model={state.model}
          notices={state.notices}
        />
      )}
      {results && <div className="rule-t p-4 sm:p-5">{results}</div>}
    </section>
  );
}
