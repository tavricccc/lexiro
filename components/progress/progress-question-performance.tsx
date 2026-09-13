"use client";

import { useMemo, useState } from "react";

import { ProgressSubpage } from "@/components/progress/progress-subpage";
import { EmptyState } from "@/components/ui/page-state";
import { SelectField } from "@/components/ui/select-field";
import { ProgressPageSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { difficultyLabel, questionFormatLabel } from "@/lib/question-options";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  emptyQuestionStats,
  QUESTION_STAT_KEYS,
  questionStatRow,
  sumQuestionStats,
} from "@/src/lib/learning-defaults";

export function ProgressQuestionPerformance() {
  const { stats, loaded } = useLearningStore();
  const library = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const [setId, setSetId] = useState("");
  const senseIds = useMemo(
    () =>
      setId
        ? (library.memberships[setId] ?? []).flatMap((entry) => entry.senseIds)
        : [],
    [library.memberships, setId],
  );
  // The account-wide breakdown is the per-sense one summed, so it is derived
  // here rather than stored a second time and kept in step.
  const questionStats = useMemo(
    () =>
      sumQuestionStats(
        setId
          ? senseIds.map(
              (senseId) =>
                stats.questionStatsBySense[senseId] ?? emptyQuestionStats(),
            )
          : Object.values(stats.questionStatsBySense),
      ),
    [senseIds, setId, stats.questionStatsBySense],
  );
  const attempted = Object.values(questionStats).reduce(
    (sum, row) => sum + row.total,
    0,
  );
  if (!loaded || libraryStatus !== "ready") return <ProgressPageSkeleton />;

  return (
    <ProgressSubpage title={t("progress.questionBreakdown")}>
      <SelectField
        ariaLabel={t("practice.set")}
        className="w-full sm:w-56"
        onValueChange={(value) => setSetId(value === "all" ? "" : value)}
        options={[
          { label: t("progress.allSets"), value: "all" },
          ...library.sets.map((entry) => ({
            label: entry.setName,
            value: entry.id,
          })),
        ]}
        value={setId || "all"}
      />
      {attempted === 0 ? (
        <EmptyState
          description={t("progress.noAttemptsDescription")}
          title={t("progress.noAttempts")}
          variant="filtered"
        />
      ) : (
        <ul className="mt-5 rule-card rule-list">
          {QUESTION_STAT_KEYS.map((key) => {
            const row = questionStatRow(questionStats, key);
            const [style, level] = key.split(":");
            const accuracy = percentage(row.correct, row.total);
            return (
              <li
                className="grid min-h-[3.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-[var(--row-padding-block)] sm:grid-cols-[12rem_minmax(0,1fr)_auto]"
                key={key}
              >
                <span className="text-sm font-medium">
                  {questionFormatLabel(style)}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {difficultyLabel(Number(level))}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="col-span-2 h-1.5 overflow-hidden rounded-full bg-brand-100 sm:order-2 sm:col-span-1"
                >
                  {row.total > 0 && (
                    <span
                      className="dashboard-bar block h-full w-full rounded-full bg-brand-500"
                      style={
                        {
                          "--dashboard-bar": accuracy / 100,
                        } as React.CSSProperties
                      }
                    />
                  )}
                </span>
                <span className="text-right text-sm tabular-nums text-muted-foreground sm:order-3">
                  {row.total > 0 ? (
                    <>
                      <span className="font-medium text-foreground">
                        {accuracy}%
                      </span>
                      <span className="ml-2">
                        {t("progress.attempts", { count: row.total })}
                      </span>
                    </>
                  ) : (
                    t("progress.noAttempts")
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ProgressSubpage>
  );
}

function percentage(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}
