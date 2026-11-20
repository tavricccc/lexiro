import * as React from "react";
import { cn } from "../lib/utils";
import { Slot } from "./slot";

/** The card grouped content sits on; `interactive` makes the whole card a pressable tile. */
export function Panel({ asChild = false, className, interactive = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean; interactive?: boolean }) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      className={cn(
        "block rounded-panel border-2 border-line bg-surface p-4 text-ink shadow-[0_4px_0_var(--line-strong)] md:p-5",
        interactive && "cursor-pointer outline-none transition-[translate,box-shadow,background-color] duration-[var(--motion-touch)] ease-[var(--ease-move)] hover:bg-surface-hover active:translate-y-1 active:shadow-[0_0_0_var(--line-strong)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Tile({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-tile bg-surface-raised p-4", className)} {...props} />;
}

export function SectionTitle({ action, children, className }: { action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3 px-1", className)}>
      <h2 className="text-lg font-extrabold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
