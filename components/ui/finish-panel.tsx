"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

/**
 * How capture ends, once nothing is left to confirm.
 *
 * Words and questions are both written as soon as they validate, so the last
 * screen is not a checkpoint — it reports what landed and asks which of the two
 * intentions this was: that was the batch, or that was one of several. Both
 * flows use this so "done" looks and reads the same wherever you arrived from.
 */
export function FinishPanel({
  children,
  description,
  finishHref,
  moreIcon: MoreIcon,
  moreLabel,
  onMore,
  title,
}: {
  /** What was produced, shown under the two ways onward. */
  children?: ReactNode;
  description: string;
  finishHref: string;
  moreIcon: LucideIcon;
  moreLabel: string;
  onMore: () => void;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader description={description} title={title} />
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button asChild className="sm:flex-1" size="lg">
          <Link href={finishHref}>
            <Icons.success />
            {t("setEditor.finish")}
          </Link>
        </Button>
        <Button
          className="sm:flex-1"
          onClick={onMore}
          size="lg"
          variant="secondary"
        >
          <MoreIcon />
          {moreLabel}
        </Button>
      </div>
      {children && <section className="section-gap">{children}</section>}
    </div>
  );
}
