"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { useUIStore } from "@/stores/ui-store";

/**
 * Registers the route title with the shared shell and keeps route-level actions
 * and back navigation at the top of the page content.
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
  const pathname = usePathname();
  const setPageTitle = useUIStore((store) => store.setPageTitle);

  useEffect(() => setPageTitle(pathname, title), [pathname, setPageTitle, title]);

  if (!actions && !back) return null;

  return (
    <header className={cn("mb-7 md:mb-9", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back ? <div className="-ml-2">{back}</div> : <span />}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
