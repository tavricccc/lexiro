"use client";

import Link from "@/components/ui/app-link";

import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { withReturnTo } from "@/lib/browse-routes";

export interface SetRowMetrics {
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
      className="t-row group flex min-h-[3.25rem] w-full items-center gap-3.5 py-[var(--row-padding-block)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={onOpen}
      type="button"
    >
      <Icons.folder
        aria-hidden
        className="size-5 shrink-0 text-success"
        weight="duotone"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-primary">
          {name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {t("library.itemCount", { count: itemCount })}
        </span>
      </span>
      <Icons.open
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  );
}

/**
 * The hairline under each set name is the same coverage bar the progress page
 * uses, so "how far through am I" is answered in the listing itself instead of
 * only after opening the set.
 */
export function SetRow({
  id,
  name,
  questionCount,
  senseCount,
  returnTo,
}: SetRowMetrics & { id: string; name: string; returnTo?: string }) {
  return (
    <Link
      className="t-row group flex min-h-[3.25rem] items-center gap-3.5 py-[var(--row-padding-block)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      href={
        returnTo ? withReturnTo(`/app/sets/${id}`, returnTo) : `/app/sets/${id}`
      }
    >
      <Icons.library
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-primary">
          {name}
        </span>
        <span className="mt-1.5 block truncate text-xs text-muted-foreground">
          {t("library.senseCount", { count: senseCount })}
          {questionCount > 0 && (
            <> · {t("library.questionCount", { count: questionCount })}</>
          )}
        </span>
      </span>
      <Icons.open
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
