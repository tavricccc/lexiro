import * as React from "react";
import { X } from "@phosphor-icons/react/ssr";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { useLabels } from "../lib/provider";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { backdropClass } from "./dialog";
import { sheetGrip } from "./popup";

/**
 * A layer over the page: a swipeable bottom sheet on a phone, a centred panel
 * elsewhere. Every exit goes through `onOpenChange`.
 */
export function Sheet({ children, description, footer, onClosed, onOpenChange, open, title }: {
  children: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  onClosed?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: React.ReactNode;
}) {
  const labels = useLabels();
  return (
    <Dialog
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => { if (!next) onClosed?.(); }}
      open={open}
      presentation="auto"
    >
      <DialogBackdrop className={backdropClass} />
      <DialogContent
        className={cn(
          "z-50 m-0 flex max-h-[calc(100svh-var(--safe-top)-1.5rem)] flex-col border-2 border-line bg-surface-solid text-ink shadow-float outline-none",
          "data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-[1.75rem] data-[presentation=sheet]:border-b-0",
          "data-[presentation=dialog]:fixed data-[presentation=dialog]:left-1/2 data-[presentation=dialog]:top-1/2 data-[presentation=dialog]:max-h-[min(44rem,calc(100svh-4rem))] data-[presentation=dialog]:w-[min(34rem,calc(100vw-4rem))] data-[presentation=dialog]:-translate-x-1/2 data-[presentation=dialog]:-translate-y-1/2 data-[presentation=dialog]:rounded-[1.75rem]",
          "data-[presentation=dialog]:transition-[opacity,scale] data-[presentation=dialog]:duration-[var(--motion-nav)] data-[presentation=dialog]:ease-[var(--ease-bounce)] data-[presentation=dialog]:data-starting-style:scale-90 data-[presentation=dialog]:data-starting-style:opacity-0 data-[presentation=dialog]:data-ending-style:scale-95 data-[presentation=dialog]:data-ending-style:opacity-0 motion-reduce:transition-none",
        )}
      >
        {(state: { presentation?: string }) => (
          <>
            <header className="flex shrink-0 flex-col px-5 pb-2 pt-3 md:px-6 md:pt-5">
              {state.presentation === "sheet" ? <div aria-hidden className={sheetGrip} /> : null}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 pt-1.5">
                  <DialogTitle className="text-lg font-extrabold md:text-xl">{title}</DialogTitle>
                  {description ? <DialogDescription className="mt-1 text-sm text-ink-muted">{description}</DialogDescription> : null}
                </div>
                <DialogClose aria-label={labels.close} className={buttonVariants({ size: "icon-sm", variant: "secondary" })}><X weight="bold" /></DialogClose>
              </div>
            </header>
            <div className="edge-fade min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-2 md:px-6 md:pb-6">{children}</div>
            {footer ? <footer className="flex shrink-0 justify-end gap-2 border-t-2 border-line px-5 pb-[max(1rem,var(--safe-bottom))] pt-4 md:px-6">{footer}</footer> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
