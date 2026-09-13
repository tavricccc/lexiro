"use client";

import { ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressPageSkeleton } from "@/components/ui/workspace-skeleton";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

/** A compact progress overview; every analysis opens as its own task. */
export function ProgressPage() {
  const { stats, loaded } = useLearningStore();
  const libraryStatus = useLibraryStore((store) => store.status);

  if (!loaded || libraryStatus !== "ready") return <ProgressPageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <PageHeader title={t("progress.title")} />
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
          {t("progress.streakLead")}
        </p>
      </section>

      <ListSection className="section-gap">
        <ListRow label={t("progress.level")} value={stats.level} />
        <ListRow label={t("progress.xp")} value={stats.xp} />
        <ListNavRow
          href="/progress/coverage"
          icon={Icons.library}
          label={t("progress.coverage")}
        />
        <ListNavRow
          href="/progress/history"
          icon={Icons.stats}
          label={t("progress.history")}
        />
        <ListNavRow
          href="/progress/questions"
          icon={Icons.practice}
          label={t("progress.questionBreakdown")}
        />
      </ListSection>
    </div>
  );
}
