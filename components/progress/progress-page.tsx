"use client";

import type { QuestionStatKey, QuestionStatTotals } from "@/types";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import { difficultyLabel, questionFormatLabel } from "@/lib/question-options";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";
import { emptyQuestionStats, QUESTION_STAT_KEYS, questionStatRow } from "@/src/lib/learning-defaults";

/**
 * The progress page is a ledger, not a dashboard: hairlines instead of cards,
 * large tabular figures for the numbers, and green reserved for the two things
 * that actually move — coverage and the daily record.
 */
export function ProgressPage() {
  const { stats, progress, loaded } = useLearningStore();
  const library = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const [setId, setSetId] = useState("");

  const senseIds = useMemo(
    () =>
      setId
        ? (library.memberships[setId] ?? []).flatMap((entry) => entry.senseIds)
        : Object.values(library.words).flatMap((word) =>
            word.senses.map((sense) => sense.id),
          ),
    [library.memberships, library.words, setId],
  );
  const learned = useMemo(
    () => senseIds.filter((id) => progress.cards[id]).length,
    [progress.cards, senseIds],
  );
  const due = useMemo(
    () =>
      senseIds.filter((id) => {
        const card = progress.cards[id];
        return card && isDue(card);
      }).length,
    [progress.cards, senseIds],
  );
  const history = useMemo(
    () =>
      Object.values(stats.dailyHistory)
        .toSorted((a, b) => a.date.localeCompare(b.date))
        .slice(-14),
    [stats.dailyHistory],
  );
  const questionStats = useMemo(() => {
    if (!setId) return stats.questionStats;
    return senseIds.reduce<QuestionStatTotals>((totals, senseId) => {
      const row = stats.questionStatsBySense[senseId];
      if (!row) return totals;
      for (const key of Object.keys(row) as QuestionStatKey[]) {
        const before = questionStatRow(totals, key);
        const incoming = questionStatRow(row, key);
        totals[key] = {
          total: before.total + incoming.total,
          correct: before.correct + incoming.correct,
          retry: before.retry + incoming.retry,
        };
      }
      return totals;
    }, emptyQuestionStats());
  }, [senseIds, setId, stats.questionStats, stats.questionStatsBySense]);

  if (!loaded || libraryStatus !== "ready") return <LoadingState />;

  const memoryAccuracy = percentage(
    stats.correctMemoryReviews,
    stats.totalMemoryReviews,
  );
  const questionAccuracy = percentage(
    stats.correctQuestionReviews,
    stats.totalQuestionReviews,
  );
  const coverage = senseIds.length ? learned / senseIds.length : 0;
  const attempted = Object.values(questionStats).reduce(
    (sum, row) => sum + row.total,
    0,
  );

  return (
    <div>
      <PageHeader
        title={t("progress.title")}
        description={t("progress.description")}
        actions={
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
        }
      />

      <section className="grid gap-x-14 gap-y-8 border-y py-8 sm:grid-cols-[auto_auto] sm:items-center sm:justify-start">
        <p>
          <span className="flex items-baseline gap-1.5">
            <span className="font-lexical text-[clamp(3.25rem,7vw,4rem)] font-medium leading-[0.9] tabular-nums text-brand-600">
              {stats.streakDays}
            </span>
            <span className="font-lexical text-lg text-brand-500">
              {t("progress.streakUnit")}
            </span>
          </span>
          <span className="mt-1.5 block text-sm text-muted-foreground">
            {t("progress.streakLead")}
          </span>
        </p>

        <dl className="grid max-w-md grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
          <Figure label={t("progress.level")} value={stats.level} />
          <Figure label={t("progress.xp")} value={stats.xp} />
          <Figure
            label={t("progress.memoryAccuracy")}
            value={`${memoryAccuracy}%`}
          />
          <Figure
            label={t("progress.questionAccuracy")}
            value={`${questionAccuracy}%`}
          />
        </dl>
      </section>

      <section className="section-gap">
        <h2 className="font-lexical text-xl font-medium">
          {t("progress.coverage")}
        </h2>
        {senseIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("progress.coverageEmpty")}
          </p>
        ) : (
          <>
            <div
              aria-hidden
              className="mt-4 h-2 overflow-hidden rounded-full bg-brand-100"
            >
              <div
                className="dashboard-bar h-full w-full rounded-full bg-brand-600"
                style={{ "--dashboard-bar": coverage } as React.CSSProperties}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("progress.coverageDetail", {
                learned,
                total: senseIds.length,
              })}
              {due > 0 && ` · ${t("progress.dueDetail", { count: due })}`}
            </p>
          </>
        )}
      </section>

      <section className="section-gap">
        <h2 className="font-lexical text-xl font-medium">
          {t("progress.history")}
        </h2>
        {history.length === 0 ? (
          <EmptyState
            description={t("progress.noActivityDescription")}
            title={t("progress.noActivity")}
            variant="filtered"
          />
        ) : (
          <>
            <HistoryChart history={history} />
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <LegendKey className="bg-brand-300" label={t("progress.memory")} />
              <LegendKey
                className="bg-brand-600"
                label={t("progress.questions")}
              />
            </p>
          </>
        )}
      </section>

      <section className="section-gap">
        <h2 className="font-lexical text-xl font-medium">
          {t("progress.questionBreakdown")}
        </h2>
        {attempted === 0 ? (
          <EmptyState
            description={t("progress.noAttemptsDescription")}
            title={t("progress.noAttempts")}
            variant="filtered"
          />
        ) : (
        <ul className="mt-4 divide-y border-y">
          {QUESTION_STAT_KEYS.map((key) => {
            const row = questionStatRow(questionStats, key);
            const [style, level] = key.split(":");
            const accuracy = percentage(row.correct, row.total);
            return (
              <li
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)_auto]"
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
      </section>
    </div>
  );
}

/**
 * Each column stacks the day's question answers on top of its memory reviews,
 * so the shape shows both how much was done and what kind of work it was.
 */
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
    <div className="mt-5 flex h-40 items-end gap-1 sm:gap-1.5">
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
                  title={t("progress.dayTotal", { count: total, date: day.date })}
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

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="font-lexical text-[1.75rem] font-medium leading-none tabular-nums">
        {value}
      </dd>
      <dt className="mt-2 text-xs text-muted-foreground">{label}</dt>
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

function percentage(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}
