import * as React from "react";
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export function Popover({ children, className, onOpenChange, open, trigger }: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger: React.ReactNode;
}) {
  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          className={cn("float-surface z-50 w-[min(22rem,calc(100vw-2rem))] rounded-none border-2 border-line-strong bg-surface-solid p-4 text-ink shadow-float outline-none", className)}
          collisionPadding={16}
          sideOffset={4}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribeToHover(onChange: () => void) {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function Tooltip({ children, label }: { children: React.ReactElement; label: string }) {
  const canHover = React.useSyncExternalStore(subscribeToHover, () => window.matchMedia(HOVER_QUERY).matches, () => false);
  if (!canHover) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="float-surface pointer-events-none z-50 rounded-none border border-line-strong bg-ink px-2.5 py-1 font-mono text-xs font-semibold text-surface" sideOffset={6}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
