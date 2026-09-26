"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Keeps the title, route actions and back navigation in the same content header.
 *
 * `lead` sits immediately before the title, for whatever identifies the header
 * rather than describes it — the brand mark on a destination's own title bar.
 */
export function PageHeader({
  actions,
  back,
  className,
  footer,
  lead,
  title,
}: {
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
  footer?: ReactNode;
  lead?: ReactNode;
  title: string;
}) {
  return (
    <header className={cn("page-header mb-6 space-y-3 md:mb-8", className)}>
      {back && <div className="-ml-2">{back}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          <h1 className="type-page min-w-0">{title}</h1>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {footer}
    </header>
  );
}
