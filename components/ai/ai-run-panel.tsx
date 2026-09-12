"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { estimatePoints, type JobKind, type Tier } from "@lexiro/ai-contract";
import type { AiRunState } from "./use-ai-generation";
import { AiUsage } from "./ai-usage";
import { GenerationControls } from "./generation-controls";
import { useManagedAccount } from "./use-managed-account";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

/**
 * The screen a generation runs on.
 *
 * The tier is a list, the one action is one button, and everything else is a
 * quiet text row underneath it. What was here before put 重新生成 and 再多生成
 * 一輪 side by side as equals, which reads as a decision and its escape; they
 * are neither, and neither is what you came to press.
 */
export function AiRunPanel<T>({
  actionLabel,
  appendBillableCount,
  billableCount,
  configured,
  kind,
  localCount = 0,
  onAppend,
  onCancel,
  onResume,
  onStart,
  onTierChange,
  ready,
  results,
  state,
  tier,
  unit,
}: {
  actionLabel: string;
  appendBillableCount?: number;
  billableCount: number;
  configured: boolean;
  kind: JobKind;
  localCount?: number;
  onAppend?: () => void;
  onCancel: () => void;
  onResume: () => void;
  onStart: () => void;
  onTierChange: (tier: Tier) => void;
  ready: boolean;
  results?: ReactNode;
  state: AiRunState<T>;
  tier: Tier;
  unit: string;
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
    <div className="space-y-7">
      <GenerationControls
        count={billableCount}
        disabled={running}
        kind={kind}
        onTierChange={onTierChange}
        tier={tier}
      />

      {started && (
        <section className="rule-card py-4">
          <h2 aria-live="polite" className="type-subsection mb-3">
            {ready ? title : t("common.loading")}
          </h2>
          <div className="flex flex-wrap justify-between gap-2 text-sm tabular-nums">
            <span aria-live="polite">
              {t("ai.completedItems", {
                completed: state.completed,
                total: state.total,
                unit,
              })}
            </span>
            <span className="text-muted-foreground">
              {t("ai.elapsed", { seconds })}
            </span>
          </div>
          <div
            aria-label={t("ai.progressLabel")}
            aria-valuemax={Math.max(1, state.total)}
            aria-valuemin={0}
            aria-valuenow={state.completed}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-inset)]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[var(--motion-control)] ease-[var(--ease-move)]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("ai.completedSegments", { count: state.segments })}</span>
            {running && (
              <span className="tabular-nums">
                {t("ai.progressCharacters", {
                  count: state.characters.toLocaleString(),
                })}
              </span>
            )}
          </div>
        </section>
      )}

      {state.error && (
        <p
          className="rounded-[var(--radius-card)] bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      {ready && !configured && billableCount > 0 && (
        <p className="type-hint">
          {t(
            process.env.NEXT_PUBLIC_AI_WORKER_URL
              ? "managed.signInRequired"
              : "managed.unavailable",
          )}{" "}
          <Link className="text-primary underline" href="/me">
            {t("common.account")}
          </Link>
        </p>
      )}

      {/* One thing to press. Everything else this screen can do is a quiet row
          under it, in the order you would reach for them. */}
      <div className="space-y-4">
        {running ? (
          <Button
            className="w-full"
            onClick={onCancel}
            size="lg"
            type="button"
            variant="outline"
          >
            <Icons.cancel />
            {t("ai.stop")}
          </Button>
        ) : (
          <>
            <Button
              className="w-full"
              disabled={!canRun}
              onClick={state.remaining > 0 && canRun ? onResume : onStart}
              size="lg"
              type="button"
            >
              <Icons.generate />
              {state.remaining > 0 && canRun
                ? t(state.status === "error" ? "ai.retryCurrent" : "ai.resume")
                : started
                  ? t("ai.regenerate")
                  : actionLabel}
            </Button>
            {(state.remaining > 0 || (done && onAppend && configured)) && (
              <ListSection>
                {state.remaining > 0 && canRun && (
                  <ListActionRow onClick={onStart}>
                    {t("ai.regenerate")}
                  </ListActionRow>
                )}
                {done && onAppend && configured && (
                  <ListActionRow onClick={onAppend}>
                    {admin
                      ? t("ai.append")
                      : t("managed.appendCost", {
                          points:
                            appendCost.min === appendCost.max
                              ? appendCost.max
                              : `${appendCost.min}–${appendCost.max}`,
                        })}
                  </ListActionRow>
                )}
              </ListSection>
            )}
          </>
        )}
        {localCount > 0 && (
          <p className="type-hint">{t("ai.builtLocally", { count: localCount })}</p>
        )}
        {started && (
          <p className="type-hint">
            {t(running ? "ai.keepWorking" : "ai.keptResults")}
          </p>
        )}
        {Array.from(new Set(state.notices)).map((notice) => (
          <p className="type-hint" key={notice}>
            {notice}
          </p>
        ))}
      </div>

      {admin && started && <AiUsage usage={state.usage} />}
      {results}
    </div>
  );
}
