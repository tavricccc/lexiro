"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

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
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const [pressedTab, setPressedTab] = React.useState<{
    fromValue: string;
    value: string;
  } | null>(null);
  const pressedResetRef = React.useRef(0);
  const displayedValue =
    pressedTab?.fromValue === value ? pressedTab.value : value;

  React.useEffect(
    () => () => window.clearTimeout(pressedResetRef.current),
    [],
  );

  const updatePill = React.useCallback(
    (animate = true) => {
      const tab = tabRefs.current[displayedValue];
      const pill = pillRef.current;
      if (!tab || !pill) return;
      if (!animate) {
        pill.style.transition = "none";
      }
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      if (!animate) {
        void pill.offsetHeight;
        pill.style.transition = "";
      }
    },
    [displayedValue],
  );

  React.useLayoutEffect(() => {
    updatePill(false);
  }, [updatePill]);

  React.useEffect(() => {
    updatePill(true);
  }, [displayedValue, updatePill]);

  React.useEffect(() => {
    const handleResize = () => updatePill(false);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updatePill]);

  const acknowledgeTab = React.useCallback(
    (nextValue: string) => {
      setPressedTab({ fromValue: value, value: nextValue });
      window.clearTimeout(pressedResetRef.current);
      pressedResetRef.current = window.setTimeout(
        () => setPressedTab(null),
        1_000,
      );
    },
    [value],
  );

  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        aria-label={ariaLabel}
        aria-disabled={disabled}
        // The rail has no height of its own: it is as tall as the tabs inside
        // it plus its own padding. A fixed height here is what let the tabs
        // outgrow it and made the rail reserve a scrollbar for the difference.
        className={cn(
          "t-tabs relative isolate inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-[var(--tabs-bar-bg)] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="t-tabs-pill absolute inset-y-[3px] left-0 z-0 w-0 rounded-full bg-[var(--tabs-pill-bg)] shadow-[var(--shadow-control)]"
          ref={pillRef}
        />
        {options.map((option) => {
          return (
            <TabsPrimitive.Trigger
              className="t-tab t-tab-label relative z-10 isolate inline-flex h-[1.75rem] shrink-0 cursor-pointer appearance-none items-center justify-center gap-1 rounded-full border-0 bg-transparent px-3 font-medium leading-none text-[var(--tabs-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              data-control-label=""
              data-liquid-tab={option.value}
              disabled={disabled}
              key={option.value}
              onPointerDown={() => {
                if (!disabled) acknowledgeTab(option.value);
              }}
              ref={(el) => {
                tabRefs.current[option.value] = el;
              }}
              value={option.value}
            >
              <span className="relative z-10 contents">{option.icon}</span>
              <span className={cn("relative z-10", option.shortLabel && "hidden sm:inline")}>
                {option.label}
              </span>
              {option.shortLabel ? (
                <span className="relative z-10 sm:hidden">{option.shortLabel}</span>
              ) : null}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
