import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const chipVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-none border px-2 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.06em] leading-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line-strong/30 bg-surface-raised text-ink",
        positive: "border-positive bg-positive/10 text-positive",
        caution: "border-caution bg-caution/10 text-caution",
        danger: "border-danger bg-danger/10 text-danger",
        info: "border-contrast bg-accent-soft text-accent-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** A concise technical classification badge. */
export function Chip({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
