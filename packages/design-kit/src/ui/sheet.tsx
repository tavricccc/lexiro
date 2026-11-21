import * as React from "react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@ui-sdk/react/drawer";
import { X } from "@phosphor-icons/react/ssr";
import { useLabels } from "../lib/provider";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { useCompactViewport } from "./use-compact-viewport";

export function Sheet({
  children,
  description,
  footer,
  layout = "sheet",
  onClosed,
  onOpenChange,
  open,
  size = "md",
  title,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  layout?: "record" | "sheet";
  onClosed?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: "md" | "screen";
  title: React.ReactNode;
}) {
  const labels = useLabels();
  const compact = useCompactViewport();

  return (
    <Drawer
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed?.();
      }}
      open={open}
      side={compact ? "bottom" : "right"}
    >
      <DrawerBackdrop className="fixed inset-0 z-50 bg-[var(--scrim)]" />
      <DrawerContent
        className={cn(
          "z-50 flex flex-col rounded-none bg-surface-solid text-ink shadow-float outline-none",
          compact
            ? cn("w-full border-t-2 border-line-strong", layout === "record" ? "h-[calc(100svh-var(--safe-top)-0.5rem)]" : "max-h-[calc(100svh-var(--safe-top)-1.5rem)]")
            : cn("h-full border-l-2 border-line-strong", size === "md" ? "w-[min(32rem,92vw)]" : "w-[min(46rem,92vw)]"),
        )}
        data-sheet-surface=""
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="relative flex shrink-0 items-start gap-4 border-b border-line-strong px-5 pb-4 pt-5 md:px-6">
            {compact ? (
              <div aria-hidden className="absolute inset-x-0 top-1.5 flex justify-center">
                <span className="h-1 w-10 bg-ink-faint/70" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 pt-0.5">
              <DrawerTitle className="text-lg font-bold tracking-[-0.02em] md:text-xl">{title}</DrawerTitle>
              {description ? (
                <DrawerDescription className="mt-1 text-sm text-ink-muted">{description}</DrawerDescription>
              ) : null}
            </div>
            <DrawerClose render={<Button aria-label={labels.close} className="relative" size="icon-sm" variant="secondary" />}>
              <X weight="bold" />
            </DrawerClose>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-5 md:px-6 md:pb-6">
            {children}
          </div>
          {footer ? (
            <footer className="flex shrink-0 justify-end gap-2 border-t border-line-strong bg-surface px-5 pb-[max(1rem,var(--safe-bottom))] pt-4 md:px-6">
              {footer}
            </footer>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
