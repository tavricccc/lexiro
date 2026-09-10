"use client";

import Link from "next/link";

import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export interface SetRowMetrics {
  due: number;
  learned: number;
  questionCount: number;
  senseCount: number;
}

/**
 * Folders and sets share one row rhythm so a mixed listing reads as a single
 * column rather than as two stacked widgets: the same left glyph, the same
 * hairline divider, the same chevron on the right.
 */
export function FolderRow({
  itemCount,
  name,
  onOpen,
}: {
  itemCount: number;
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      aria-label={t("library.openFolder", { name })}
      className="group flex w-full items-center gap-3.5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={onOpen}
      type="button"
    >
      <Icons.folder
        aria-hidden
        className="size-5 shrink-0 fill-brand-100 text-brand-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-primary">
          {name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {t("library.itemCount", { count: itemCount })}
        </span>
      </span>
      <Icons.open aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * The hairline under each set name is the same coverage bar the progress page
 * uses, so "how far through am I" is answered in the listing itself instead of
 * only after opening the set.
 */
export function SetRow({
  due,
  id,
  learned,
  name,
  questionCount,
  senseCount,
}: SetRowMetrics & { id: string; name: string }) {
  const coverage = senseCount ? learned / senseCount : 0;

  return (
    <Link
      className="group flex items-center gap-3.5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      href={`/sets/${id}`}
    >
      <Icons.library
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-primary">
          {name}
        </span>
        <span
          aria-hidden
          className="mt-2 block h-0.5 w-full max-w-32 overflow-hidden rounded-full bg-brand-100"
        >
          <span
            className="dashboard-bar block h-full w-full bg-brand-500"
            style={{ "--dashboard-bar": coverage } as React.CSSProperties}
          />
        </span>
        <span className="mt-1.5 block truncate text-xs text-muted-foreground">
          {t("library.senseCount", { count: senseCount })}
          {" · "}
          {t("setDetail.learnedCount", { count: learned })}
          {questionCount > 0 && (
            <> · {t("library.questionCount", { count: questionCount })}</>
          )}
        </span>
      </span>
      {due > 0 && (
        <span className="shrink-0 text-xs font-medium tabular-nums text-brand-600">
          {t("setDetail.dueCount", { count: due })}
        </span>
      )}
      <Icons.open aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
