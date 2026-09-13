"use client";

import { useMemo } from "react";

import { ProgressSubpage } from "@/components/progress/progress-subpage";
import { EmptyState } from "@/components/ui/page-state";
import { ProgressPageSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

export function ProgressHistory() {
  const { stats, loaded } = useLearningStore();
  const libraryStatus = useLibraryStore((store) => store.status);
  const history = useMemo(
    () =>
      Object.values(stats.dailyHistory)
        .toSorted((a, b) => a.date.localeCompare(b.date))
        .slice(-14),
    [stats.dailyHistory],
  );
  if (!loaded || libraryStatus !== "ready") return <ProgressPageSkeleton />;

  return (
    <ProgressSubpage title={t("progress.history")}>
      {history.length === 0 ? (
        <EmptyState
          description={t("progress.noActivityDescription")}
          title={t("progress.noActivity")}
          variant="filtered"
        />
      ) : (
        <section className="rule-card py-5">
          <HistoryChart history={history} />
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <LegendKey className="bg-brand-300" label={t("progress.memory")} />
            <LegendKey
              className="bg-brand-600"
              label={t("progress.questions")}
            />
          </p>
        </section>
      )}
    </ProgressSubpage>
  );
}

function HistoryChart({
  history,
}: {
  history: {
    date: string;
    memoryAgain: number;
    memoryGood: number;
    questionTotal: number;
  }[];
}) {
  const busiest = Math.max(
    1,
    ...history.map(
      (day) => day.memoryAgain + day.memoryGood + day.questionTotal,
    ),
  );
  return (
    <div className="flex h-40 items-end gap-1 sm:gap-1.5">
      {history.map((day, index) => {
        const memory = day.memoryAgain + day.memoryGood;
        const total = memory + day.questionTotal;
        return (
          <div
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            key={day.date}
          >
            <div className="flex w-full flex-1 items-end justify-center">
              {total === 0 ? (
                <span
                  className="h-px w-full max-w-9 bg-border"
                  title={t("progress.dayTotal", { count: 0, date: day.date })}
                />
              ) : (
                <span
                  className="dashboard-column flex w-full max-w-9 flex-col overflow-hidden rounded-t-[3px]"
                  style={{
                    animationDelay: `${index * 25}ms`,
                    height: `${Math.max(4, (total / busiest) * 100)}%`,
                  }}
                  title={t("progress.dayTotal", {
                    count: total,
                    date: day.date,
                  })}
                >
                  <span
                    className="block bg-brand-600"
                    style={{ flexBasis: 0, flexGrow: day.questionTotal }}
                  />
                  <span
                    className="block bg-brand-300"
                    style={{ flexBasis: 0, flexGrow: memory }}
                  />
                </span>
              )}
            </div>
            <span className="text-[0.625rem] leading-none tabular-nums text-muted-foreground">
              {Number(day.date.slice(8))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={`size-2 rounded-[2px] ${className}`} />
      {label}
    </span>
  );
}
