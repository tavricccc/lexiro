import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export function Dialog({
  actions,
  children,
  className,
  description,
  dismissible = true,
  icon,
  onOpenChange,
  open,
  title,
}: {
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
  const block = (event: Event) => { if (!dismissible) event.preventDefault(); };
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="scrim fixed inset-0 z-50 bg-[var(--scrim)]" />
        <DialogPrimitive.Content
          className={cn(
            "dialog-surface fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100svh-2rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-none border-2 border-line-strong bg-surface-solid p-6 text-ink shadow-float outline-none",
            className,
          )}
          onEscapeKeyDown={block}
          onInteractOutside={block}
        >
          <div className="grid gap-2 border-b border-line pb-4">
            {icon ? (
              <span aria-hidden className="mb-1 grid size-10 place-items-center border border-line-strong bg-surface-raised text-ink [&_svg]:size-5">{icon}</span>
            ) : null}
            <DialogPrimitive.Title className="text-xl font-bold tracking-[-0.02em]">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          {actions ? <div className="flex flex-wrap justify-end gap-2 pt-1">{actions}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
