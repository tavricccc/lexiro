"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  aboveNavigation = false,
}: {
  children: ReactNode;
  className?: string;
  width?: "narrow" | "wide";
  aboveNavigation?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setHost(document.body), []);
  useLayoutEffect(() => {
    if (!host) return;
    const panel = panelRef.current!;
    const observer = new ResizeObserver(() =>
      setHeight(panel.getBoundingClientRect().height),
    );
    observer.observe(panel);
    setHeight(panel.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [host]);
  return (
    <div
      className="action-space mt-4 min-h-[5.5rem]"
      data-step-actions-space
      style={{ minHeight: height || undefined }}
    >
      {host &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              "app-action-bar fixed inset-x-0 bottom-0 z-40 border-t bg-card px-[max(var(--page-gutter),var(--safe-left),var(--safe-right))] pb-[max(0.75rem,var(--safe-bottom))] pt-3",
              className,
            )}
            data-above-navigation={aboveNavigation}
          >
            <div
              className={cn(
                "mx-auto grid gap-2",
                width === "wide" ? "max-w-3xl" : "max-w-xl",
              )}
            >
              {children}
            </div>
          </div>,
          host,
        )}
    </div>
  );
}
