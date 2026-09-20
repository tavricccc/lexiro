import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The always-reachable action surface for a single-step screen.
 *
 * It reserves its own space in the document, then pins the actual controls to
 * the safe bottom edge. Long review lists can scroll without hiding the one
 * action that advances the flow.
 */
export function StepActions({
  children,
  className,
  width = "narrow",
}: {
  children: ReactNode;
  className?: string;
  width?: "narrow" | "wide";
}) {
  return (
    <div className="mt-7 min-h-[7.5rem]" data-step-actions-space>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-[color-mix(in_srgb,var(--surface-stage)_90%,transparent)] px-[max(var(--page-gutter),var(--safe-left),var(--safe-right))] pb-[max(1rem,var(--safe-bottom))] pt-3 backdrop-blur-xl md:left-60",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto grid gap-2",
            width === "wide" ? "max-w-3xl" : "max-w-xl",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
