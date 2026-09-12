"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * How capture ends, once nothing is left to confirm.
 *
 * The final screen is deliberately separate from the material that preceded it:
 * it returns to the top, reports only what landed, and asks whether the user is
 * finished or wants another batch. Both capture flows use this so completion
 * looks and behaves the same wherever the user arrived from.
 */
export function FinishPanel({
  description,
  finishHref,
  moreIcon: MoreIcon,
  moreLabel,
  onMore,
  title,
}: {
  description?: string;
  finishHref: string;
  moreIcon: LucideIcon;
  moreLabel: string;
  onMore: () => void;
  title: string;
}) {
  useLayoutEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, []);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icons.success className="size-7" />
      </div>
      <h1 className="mt-5 type-page">{title}</h1>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row">
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
    </div>
  );
}
