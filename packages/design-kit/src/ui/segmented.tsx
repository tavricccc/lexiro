import * as React from "react";
import { motion } from "motion/react";
import { Tabs } from "radix-ui";
import { timing } from "../lib/motion-timing";
import { cn } from "../lib/utils";

export interface SegmentedOption<Value extends string = string> {
  icon?: React.ReactNode;
  label: string;
  value: Value;
}

/**
 * Architectural rectangular tab selector with a sharp sliding ink/Klein block.
 */
export function Segmented<Value extends string>({
  className,
  label,
  onChange,
  options,
  size = "md",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: Value) => void;
  options: SegmentedOption<Value>[];
  size?: "md" | "lg";
  value: Value;
}) {
  const pillId = React.useId();
  return (
    <Tabs.Root className={cn("min-w-0 max-w-full", className)} onValueChange={(next) => onChange(next as Value)} value={value}>
      <Tabs.List aria-label={label} asChild>
        <motion.div
          className="inline-flex max-w-full items-stretch divide-x divide-line border border-line-strong bg-surface overflow-x-auto [scrollbar-width:none]"
          layoutRoot
        >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Tabs.Trigger
              className={cn(
                "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 rounded-none font-semibold tracking-[-0.01em] outline-none transition-[color,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast",
                size === "lg" ? "h-11 px-5 text-[0.9375rem]" : "h-9 px-3.5 text-sm",
                selected ? "text-on-contrast" : "text-ink-muted hover:bg-surface-raised hover:text-ink",
              )}
              key={option.value}
              value={option.value}
            >
              {selected ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-contrast"
                  initial={false}
                  layoutId={pillId}
                  transition={timing("control", "nav")}
                />
              ) : null}
              {option.icon ? <span aria-hidden className="inline-flex [&_svg]:size-4">{option.icon}</span> : null}
              {option.label}
            </Tabs.Trigger>
          );
        })}
        </motion.div>
      </Tabs.List>
    </Tabs.Root>
  );
}
