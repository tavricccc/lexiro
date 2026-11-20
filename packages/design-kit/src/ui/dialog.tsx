import * as React from "react";
import { Dialog as DialogRoot, DialogBackdrop, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { cn } from "../lib/utils";

export const backdropClass =
  "fixed inset-0 z-50 bg-[var(--scrim)] transition-opacity duration-[var(--motion-control)] data-starting-style:opacity-0 data-ending-style:opacity-0";

export const centeredClass =
  "fixed left-1/2 top-1/2 z-50 m-0 grid max-h-[calc(100svh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-[1.75rem] border-2 border-line bg-surface-solid p-6 text-ink shadow-float outline-none transition-[opacity,scale] duration-[var(--motion-nav)] ease-[var(--ease-bounce)] data-starting-style:scale-90 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none";

/** A centred question or explanation. `dismissible={false}` keeps Escape and outside presses from closing it. */
export function Dialog({ actions, children, className, description, dismissible = true, icon, onOpenChange, open, title }: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  dismissible?: boolean;
  icon?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  title: React.ReactNode;
}) {
  return (
    <DialogRoot dismissible={dismissible} onOpenChange={(next) => onOpenChange?.(next)} open={open}>
      <DialogBackdrop className={backdropClass} />
      <DialogContent className={cn(centeredClass, "w-[min(26rem,calc(100vw-2rem))]", className)}>
        <div className="grid gap-2">
          {icon ? <span aria-hidden className="mb-2 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink [&_svg]:size-7">{icon}</span> : null}
          <DialogTitle className="text-xl font-extrabold">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</DialogDescription> : null}
        </div>
        {children}
        {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
      </DialogContent>
    </DialogRoot>
  );
}
