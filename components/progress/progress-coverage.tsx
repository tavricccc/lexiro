"use client";

import { useMemo, useState } from "react";

import { ProgressSubpage } from "@/components/progress/progress-subpage";
import { SelectField } from "@/components/ui/select-field";
import { ProgressPageSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";

export function ProgressCoverage() {
  const { progress, loaded } = useLearningStore();
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
      senseIds.filter((id) => progress.cards[id] && isDue(progress.cards[id]))
        .length,
    [progress.cards, senseIds],
  );

  if (!loaded || libraryStatus !== "ready") return <ProgressPageSkeleton />;
  const coverage = senseIds.length ? learned / senseIds.length : 0;
  return (
    <ProgressSubpage title={t("progress.coverage")}>
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
      {senseIds.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          {t("progress.coverageEmpty")}
        </p>
      ) : (
        <section className="rule-card mt-5 py-5">
          <div
            aria-hidden
            className="h-2 overflow-hidden rounded-full bg-brand-100"
          >
            <div
              className="dashboard-bar h-full w-full rounded-full bg-brand-600"
              style={{ "--dashboard-bar": coverage } as React.CSSProperties}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("progress.coverageDetail", { learned, total: senseIds.length })}
            {due > 0 && ` · ${t("progress.dueDetail", { count: due })}`}
          </p>
        </section>
      )}
    </ProgressSubpage>
  );
}
