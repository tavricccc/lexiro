import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The single page header for every route. Titles use the lexical scale so each
 * screen opens in the same editorial voice as the study material.
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
    <header className={cn("mb-6 md:mb-8", className)}>
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-lexical text-[1.75rem] font-medium leading-[1.15] tracking-[-0.005em] md:text-[2rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
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
