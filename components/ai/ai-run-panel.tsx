"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { estimatePoints, type JobKind, type Tier } from "@lexiro/ai-contract";
import type { AiRunState } from "./use-ai-generation";
import { AiUsage } from "./ai-usage";
import { GenerationControls } from "./generation-controls";
import { useManagedAccount } from "./use-managed-account";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { TaskProgress } from "@/components/ui/task-progress";
import { t } from "@/lib/i18n";

function formatDiagnostic(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

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
  onReview,
  onStart,
  onTierChange,
  ready,
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
  /** Going on to the step that reviews what came back. */
  onReview?: () => void;
  onStart: () => void;
  onTierChange: (tier: Tier) => void;
  ready: boolean;
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
        <TaskProgress
          elapsed={t("ai.elapsed", { seconds })}
          label={t("ai.progressLabel")}
          max={state.total}
          summary={t("ai.completedItems", {
            completed: state.completed,
            total: state.total,
            unit,
          })}
          title={ready ? title : t("common.loading")}
          value={state.total ? state.completed : done ? 1 : 0}
        >
          <span>{t("ai.completedSegments", { count: state.segments })}</span>
          {running && (
            <span className="tabular-nums">
              {t("ai.progressCharacters", {
                count: state.characters.toLocaleString(),
              })}
            </span>
          )}
        </TaskProgress>
      )}

      {state.error && (
        <p
          className="rounded-[var(--radius-card)] bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      {admin && state.error && state.diagnostic && (
        <details open className="border-t pt-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {t("ai.adminDiagnostic")}
          </summary>
          {state.diagnostic.responseId && (
            <p className="mt-3 break-all text-xs text-muted-foreground">
              {t("ai.adminResponseId", {
                id: state.diagnostic.responseId,
              })}
            </p>
          )}
          {state.diagnostic.request && (
            <div className="mt-3">
              <p className="mb-1 font-medium">{t("ai.adminRequest")}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--surface-inset)] p-3 text-xs">
                {formatDiagnostic(state.diagnostic.request)}
              </pre>
            </div>
          )}
          <div className="mt-3">
            <p className="mb-1 font-medium">{t("ai.adminResponse")}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--surface-inset)] p-3 text-xs">
              {formatDiagnostic(state.diagnostic.response)}
            </pre>
          </div>
        </details>
      )}

      {ready && !configured && billableCount > 0 && (
        <p className="type-hint">
          {t(
            process.env.NEXT_PUBLIC_AI_WORKER_URL
              ? "managed.signInRequired"
              : "managed.unavailable",
          )}{" "}
          <Link className="text-primary underline" href="/app/me">
            {t("common.account")}
          </Link>
        </p>
      )}

      {localCount > 0 && (
        <p className="type-hint">
          {t("ai.builtLocally", { count: localCount })}
        </p>
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

      {admin && started && <AiUsage usage={state.usage} />}

      <StepActions width="wide">
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
              disabled={done && onReview ? false : !canRun}
              onClick={
                done && onReview
                  ? onReview
                  : state.remaining > 0 && canRun
                    ? onResume
                    : onStart
              }
              size="lg"
              type="button"
            >
              {done && onReview ? <Icons.next /> : <Icons.generate />}
              {done && onReview
                ? t("ai.viewResults")
                : state.remaining > 0 && canRun
                  ? t(
                      state.status === "error"
                        ? "ai.retryCurrent"
                        : "ai.resume",
                    )
                  : started
                    ? t("ai.regenerate")
                    : actionLabel}
            </Button>
            {(state.remaining > 0 || (done && onReview)) && canRun && (
              <Button onClick={onStart} type="button" variant="ghost">
                <Icons.generate />
                {t("ai.regenerate")}
              </Button>
            )}
            {state.remaining > 0 && state.items.length > 0 && onReview && (
              <Button onClick={onReview} type="button" variant="ghost">
                <Icons.next />
                {t("ai.viewCompletedResults")}
              </Button>
            )}
            {done && onAppend && configured && (
              <Button onClick={onAppend} type="button" variant="ghost">
                <Icons.generate />
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
      </StepActions>
    </div>
  );
}
