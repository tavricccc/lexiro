"use client";

import { type ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand";
import { PageHeader } from "@/components/ui/page-header";
import { SyncIndicator } from "@/components/sync-indicator";

/**
 * The title bar of a primary destination.
 *
 * On a phone this is the only header the screen has, so it carries the brand
 * mark and the sync status alongside the title and whatever the page itself
 * offers. It replaces a separate row that said 「Lexiro」 above the title and
 * nothing else — the mark alone says the same thing, and the row it cost is
 * better spent on the screen.
 *
 * On a desktop the sidebar already holds both the wordmark and the sync status,
 * so the header keeps only the title and the page's own actions.
 */
export function RootPageHeader({
  actions,
  className,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <PageHeader
      actions={
        <>
          {actions}
          <SyncIndicator className="md:hidden" />
        </>
      }
      className={className}
      lead={<BrandMark className="size-8 md:hidden" />}
      title={title}
    />
  );
}
