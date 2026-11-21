import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";

/** Sharp Swiss structural module on the grid. */
export function Panel({
  asChild = false,
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean; interactive?: boolean }) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(
        "block rounded-none border border-line bg-surface p-5 text-ink md:p-6",
        interactive &&
          "outline-none transition-[background-color,border-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:border-line-strong hover:bg-surface-raised focus-visible:border-contrast focus-visible:ring-1 focus-visible:ring-contrast",
        className,
      )}
      {...props}
    />
  );
}

/** A quieter architectural cell nested inside a module or grid. */
export function Tile({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-none border border-line bg-surface p-4", className)} {...props} />;
}

export function SectionTitle({ action, children, className }: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-baseline justify-between gap-4 border-b border-line-strong pb-2", className)}>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.09em] text-ink">{children}</h2>
      {action}
    </div>
  );
}
