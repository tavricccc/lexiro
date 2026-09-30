"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

/** Mobile actions use the safe bottom edge; desktop actions join the sticky page header. */
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [height, setHeight] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const media = window.matchMedia("(min-width: 48rem)");
    const placeActions = () => {
      setDesktop(media.matches);
      if (!media.matches) {
        setHost(document.body);
        return;
      }
      let screen = anchorRef.current!.parentElement!;
      while (!screen.querySelector("[data-page-actions-host]"))
        screen = screen.parentElement!;
      setHost(screen.querySelector<HTMLElement>("[data-page-actions-host]"));
    };
    placeActions();
    media.addEventListener("change", placeActions);
    return () => media.removeEventListener("change", placeActions);
  }, []);
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
      ref={anchorRef}
      className={desktop ? "hidden" : "action-space mt-4 min-h-[5.5rem]"}
      data-step-actions-space
      style={{ minHeight: height || undefined }}
    >
      {host &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              "app-action-bar",
              desktop
                ? "app-action-bar-inline"
                : "fixed inset-x-0 bottom-0 z-40 border-t bg-card px-[max(var(--page-gutter),var(--safe-left),var(--safe-right))] pb-[max(0.75rem,var(--safe-bottom))] pt-3",
              className,
            )}
            data-above-navigation={aboveNavigation}
            data-placement={desktop ? "header" : "bottom"}
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
