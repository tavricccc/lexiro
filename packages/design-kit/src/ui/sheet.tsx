import * as React from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "@phosphor-icons/react/ssr";
import { useLabels } from "../lib/provider";
import { timing } from "../lib/motion-timing";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { useCompactViewport } from "./use-compact-viewport";

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;

function useGrabber(onDismiss: () => void) {
  const offset = useMotionValue(0);
  const start = React.useRef<{ time: number; y: number } | null>(null);
  const handlers = {
    onPointerCancel: () => { start.current = null; void animate(offset, 0, timing("control", "nav")); },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { time: event.timeStamp, y: event.clientY };
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (start.current) offset.set(Math.max(0, event.clientY - start.current.y));
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (!start.current) return;
      const distance = event.clientY - start.current.y;
      const velocity = distance / Math.max(1, event.timeStamp - start.current.time);
      start.current = null;
      if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onDismiss();
      else void animate(offset, 0, timing("control", "nav"));
    },
  };
  return { handlers, offset };
}

/**
 * Swiss architectural drawer: rises sharply from bottom on phone, slides cleanly
 * from the right edge (or wide modal for `screen`) on desktop.
 */
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
  const grabber = useGrabber(() => onOpenChange(false));
  const scrimOpacity = useTransform(grabber.offset, [0, 480], [1, 0.2]);
  const pulled = useTransform(grabber.offset, (y) => `0 ${y}px`);
  const { offset } = grabber;

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <AnimatePresence onExitComplete={() => { offset.set(0); onClosed?.(); }}>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-[var(--scrim)]"
                exit={{ opacity: 0, transition: { duration: 0 } }}
                initial={{ opacity: 0 }}
                style={compact ? { opacity: scrimOpacity } : undefined}
                transition={timing("sheet", "nav")}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                animate={compact ? { y: 0 } : { x: 0, opacity: 1 }}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-none border-t-2 border-line-strong bg-surface-solid text-ink shadow-float outline-none",
                  layout === "record" ? "top-[calc(var(--safe-top)+0.5rem)]" : "max-h-[calc(100svh-var(--safe-top)-1.5rem)]",
                  "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:max-h-none md:border-l-2 md:border-t-0",
                  size === "md" && "md:w-[min(32rem,92vw)]",
                  size === "screen" && "md:w-[min(46rem,92vw)]",
                )}
                data-sheet-surface=""
                exit={compact
                  ? { transition: timing("sheetExit", "nav"), y: "100%" }
                  : { x: "100%", opacity: 0.4, transition: timing("controlExit", "depart") }}
                initial={compact ? { y: "100%" } : { x: "100%", opacity: 0.4 }}
                style={compact ? { translate: pulled } : undefined}
                transition={compact ? timing("sheet", "nav") : timing("nav", "nav")}
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <header className="relative flex shrink-0 items-start gap-4 border-b border-line-strong px-5 pb-4 pt-5 md:px-6">
                    {compact ? (
                      <div aria-hidden className="absolute inset-x-0 top-0 flex h-5 touch-none cursor-grab justify-center pt-1.5" {...grabber.handlers}>
                        <span className="h-1 w-10 bg-ink-faint/70" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <Dialog.Title className="text-lg font-bold tracking-[-0.02em] md:text-xl">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-1 text-sm text-ink-muted">{description}</Dialog.Description>
                      ) : null}
                    </div>
                    <Dialog.Close asChild>
                      <Button aria-label={labels.close} className="relative" size="icon-sm" variant="secondary"><X weight="bold" /></Button>
                    </Dialog.Close>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-5 md:px-6 md:pb-6">{children}</div>
                  {footer ? (
                    <footer className="flex shrink-0 justify-end gap-2 border-t border-line-strong bg-surface px-5 pb-[max(1rem,var(--safe-bottom))] pt-4 md:px-6">{footer}</footer>
                  ) : null}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
