"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Keeps the title, route actions and back navigation in the same content header.
 */
export function PageHeader({
  actions,
  back,
  className,
  title,
}: {
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <header className={cn("mb-5 space-y-3 md:mb-6", className)}>
      {back && <div className="-ml-2">{back}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-page min-w-0">{title}</h1>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
