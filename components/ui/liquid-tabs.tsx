"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { timing } from "@/lib/motion-timing";

import { cn } from "@/lib/cn";

export interface LiquidTabOption {
  icon?: React.ReactNode;
  label: string;
  shortLabel?: string;
  value: string;
}

interface LiquidTabsProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: LiquidTabOption[];
  value: string;
}

export function LiquidTabs({
  ariaLabel,
  className,
  disabled = false,
  onValueChange,
  options,
  value,
}: LiquidTabsProps) {
  const layoutId = React.useId();

  return (
    <TabsPrimitive.Root
      className={cn("min-w-0 max-w-full", className)}
      value={value}
      onValueChange={onValueChange}
    >
      {/* The rail is the pill's frame of reference, and it scrolls on its own
          axis, so measuring the pill against the document would offset it by
          whatever the rail has scrolled. */}
      <TabsPrimitive.List asChild aria-label={ariaLabel} aria-disabled={disabled}>
        <motion.div
          layoutRoot
          layoutScroll
          // The rail has no height of its own: it is as tall as the tabs inside
          // it plus its own padding. A fixed height here is what let the tabs
          // outgrow it and made the rail reserve a scrollbar for the difference.
          className="t-tabs relative isolate inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-[var(--tabs-bar-bg)] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((option) => {
            return (
              <TabsPrimitive.Trigger
                className="t-tab t-tab-label relative z-10 isolate inline-flex h-[1.75rem] shrink-0 cursor-pointer appearance-none items-center justify-center gap-1 rounded-full border-0 bg-transparent px-3 font-medium leading-none text-[var(--tabs-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                data-control-label=""
                data-liquid-tab={option.value}
                data-displayed-active={option.value === value}
                disabled={disabled}
                key={option.value}
                value={option.value}
              >
                {option.value === value && (
                  <motion.span
                    aria-hidden
                    className="t-tabs-pill absolute inset-0 z-0 rounded-full bg-[var(--tabs-pill-bg)] shadow-[var(--shadow-control)]"
                    initial={false}
                    layoutId={`liquid-tab-pill-${layoutId}`}
                    transition={timing("nav", "nav")}
                  />
                )}
                <span className="relative z-10 contents">{option.icon}</span>
                <span
                  className={cn(
                    "relative z-10",
                    option.shortLabel && "hidden sm:inline",
                  )}
                >
                  {option.label}
                </span>
                {option.shortLabel ? (
                  <span className="relative z-10 sm:hidden">
                    {option.shortLabel}
                  </span>
                ) : null}
              </TabsPrimitive.Trigger>
            );
          })}
        </motion.div>
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
