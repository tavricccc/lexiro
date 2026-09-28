"use client";

import { type ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SyncIndicator } from "@/components/sync-indicator";

/** Page identity and actions; the app mark belongs in account/about, not every task. */
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
      title={title}
    />
  );
}
