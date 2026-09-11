import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The single page header for every route. The title and the sentence under it
 * are one block on the shared type scale, so every screen opens at the same
 * rank and in the same editorial voice as the study material.
 */
export function PageHeader({
  actions,
  back,
  className,
  description,
  title,
}: {
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <header className={cn("mb-7 md:mb-9", className)}>
      {back && <div className="mb-3 -ml-2">{back}</div>}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0">
          <h1 className="type-page">{title}</h1>
          {description && <p className="type-lead">{description}</p>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
