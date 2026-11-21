import * as React from "react";
import {
  Popover as UIPopover,
  PopoverContent,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { cn } from "../lib/utils";

export function Popover({ children, className, onOpenChange, open, trigger }: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger: React.ReactElement;
}) {
  return (
    <UIPopover onOpenChange={(next) => onOpenChange?.(next)} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="end"
        className={cn(
          "z-50 w-[min(22rem,calc(100vw-2rem))] rounded-none border-2 border-line-strong bg-surface-solid p-4 text-ink shadow-float outline-none transition-[opacity,scale] duration-[var(--motion-control)] data-starting-style:opacity-0 data-starting-style:scale-[0.985] data-ending-style:opacity-0 data-ending-style:scale-[0.985]",
          className,
        )}
        collisionPadding={16}
        sideOffset={4}
      >
        {children}
      </PopoverContent>
    </UIPopover>
  );
}

/** ui-sdk Tooltips need no provider; kept as a passthrough for existing callers. */
export function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
  return <>{children}</>;
}

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
    <UITooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        className="pointer-events-none z-50 rounded-none border border-line-strong bg-ink px-2.5 py-1 font-mono text-xs font-semibold text-surface transition-opacity duration-[var(--motion-touch)] data-starting-style:opacity-0 data-ending-style:opacity-0"
        sideOffset={6}
      >
        {label}
      </TooltipContent>
    </UITooltip>
  );
}
