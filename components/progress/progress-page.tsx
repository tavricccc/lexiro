"use client";

import { useMemo } from "react";

import { ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { RootPageHeader } from "@/components/root-page-header";
import { ProgressPageSkeleton } from "@/components/ui/workspace-skeleton";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { countActiveDays } from "@/src/lib/learning-defaults";
import { countMastery } from "@/src/lib/library-metrics";

const WEEK_DAYS = 7;

/**
 * A compact progress overview; every analysis opens as its own task.
 *
 * Every figure here is a reading of where the learning actually stands — what
 * is known, what today asked for, how much of the week was practised. The two
 * rows this replaced were an experience total and that total divided by a
 * hundred, which measured how many times a button had been pressed and nothing
 * else.
 */
export function ProgressPage() {
  const { progress, stats, loaded } = useLearningStore();
  const library = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const mastery = useMemo(
    () => countMastery(library.words, progress.cards),
    [library.words, progress.cards],
  );
  const activeDays = useMemo(
    () => countActiveDays(stats.dailyHistory, WEEK_DAYS),
    [stats.dailyHistory],
  );

  if (!loaded || libraryStatus !== "ready") return <ProgressPageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <RootPageHeader title={t("progress.title")} />
      <section className="rule-card py-6">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[4rem] font-medium leading-[0.9] tabular-nums text-brand-600">
            {stats.streakDays}
          </span>
          <span className="text-lg text-brand-500">
            {t("progress.streakUnit")}
          </span>
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {stats.streakFreezes > 0
            ? t("progress.streakProtected", { count: stats.streakFreezes })
            : t("progress.streakLead")}
        </p>
      </section>

      <ListSection className="section-gap">
        <ListRow
          label={t("progress.mastered")}
          value={t("progress.masteredValue", {
            mastered: mastery.mastered,
            total: mastery.total,
          })}
        />
        <ListRow
          label={t("progress.todayWords")}
          value={t("progress.goalValue", {
            done: stats.todayMemoryReviews,
            goal: stats.dailyWordGoal,
          })}
        />
        <ListRow
          label={t("progress.todayQuestions")}
          value={t("progress.goalValue", {
            done: stats.todayQuestionReviews,
            goal: stats.dailyQuestionGoal,
          })}
        />
        <ListRow
          label={t("progress.weekActive")}
          value={t("progress.weekActiveValue", { days: activeDays })}
        />
        <ListNavRow
          href="/app/progress/coverage"
          icon={Icons.library}
          label={t("progress.coverage")}
        />
        <ListNavRow
          href="/app/progress/history"
          icon={Icons.stats}
          label={t("progress.history")}
        />
        <ListNavRow
          href="/app/progress/questions"
          icon={Icons.practice}
          label={t("progress.questionBreakdown")}
        />
      </ListSection>
    </div>
  );
}
