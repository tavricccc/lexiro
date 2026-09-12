"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { estimatePoints, type JobKind, type Tier } from "@lexiro/ai-contract";
import type { AiRunState } from "./use-ai-generation";
import { GenerationControls } from "./generation-controls";
import { AiUsage } from "./ai-usage";
import { useManagedAccount } from "./use-managed-account";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function AiRunPanel<T>({
  actionLabel,
  configured,
  ready,
  localCount = 0,
  onCancel,
  onResume,
  onStart,
  onAppend,
  results,
  scopeSummary,
  state,
  unit,
  kind,
  billableCount,
  appendBillableCount,
  tier,
  onTierChange,
}: {
  actionLabel: string;
  configured: boolean;
  ready: boolean;
  localCount?: number;
  onCancel: () => void;
  onResume: () => void;
  onStart: () => void;
  onAppend?: () => void;
  results?: ReactNode;
  scopeSummary: string;
  state: AiRunState<T>;
  unit: string;
  kind: JobKind;
  billableCount: number;
  appendBillableCount?: number;
  tier: Tier;
  onTierChange: (tier: Tier) => void;
}) {
  const [now, setNow] = useState(0);
  const account = useManagedAccount();
  const admin = account.data?.admin === true;
  const running = state.status === "running",
    started = state.status !== "idle",
    done = state.status === "done";
  const canRun =
    ready &&
    (configured || !billableCount) &&
    Boolean(billableCount || localCount);
  const appendCost = estimatePoints(
    kind,
    appendBillableCount ?? billableCount,
    tier,
  );
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
  const title = running
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
        <p className="text-xs text-muted-foreground">{scopeSummary}</p>
        <h3 className="mt-1 text-base font-semibold" aria-live="polite">
          {ready ? title : t("common.loading")}
        </h3>
        <div className="mt-4">
          <GenerationControls
            kind={kind}
            count={billableCount}
            tier={tier}
            onTierChange={onTierChange}
            disabled={running}
          />
        </div>
        {started && (
          <div className="mt-5">
            <div className="flex flex-wrap justify-between gap-2 text-sm tabular-nums">
              <span aria-live="polite">
                {t("ai.completedItems", {
                  completed: state.completed,
                  total: state.total,
                  unit,
                })}
              </span>
              <span>{t("ai.elapsed", { seconds })}</span>
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
                className="h-full rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {t("ai.completedSegments", { count: state.segments })}
              </span>
              {running && (
                <span>
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
            className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {ready && !configured && billableCount > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t(
              process.env.NEXT_PUBLIC_AI_WORKER_URL
                ? "managed.signInRequired"
                : "managed.unavailable",
            )}{" "}
            <Link href="/me" className="text-primary underline">
              {t("common.account")}
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
              <Button
                type="button"
                variant={started ? "outline" : "default"}
                disabled={!canRun}
                onClick={onStart}
              >
                <Icons.generate />
                {started ? t("ai.regenerate") : actionLabel}
              </Button>
              {done && onAppend && configured && (
                <Button type="button" variant="secondary" onClick={onAppend}>
                  <Icons.create />
                  {admin
                    ? t("ai.append")
                    : t("managed.appendCost", {
                        points:
                          appendCost.min === appendCost.max
                            ? appendCost.max
                            : `${appendCost.min}–${appendCost.max}`,
                      })}
                </Button>
              )}
            </>
          )}
        </div>
        {started && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t(running ? "ai.keepWorking" : "ai.keptResults")}
          </p>
        )}
        {Array.from(new Set(state.notices)).map((notice) => (
          <p key={notice} className="mt-2 text-xs text-muted-foreground">
            {notice}
          </p>
        ))}
      </div>
      {admin && started && <AiUsage usage={state.usage} />}
      {results && <div className="rule-t p-4 sm:p-5">{results}</div>}
    </section>
  );
}
