import * as React from "react";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { cn } from "../lib/utils";

export interface SegmentedOption<Value extends string = string> {
  icon?: React.ReactNode;
  label: string;
  value: Value;
}

export function Segmented<Value extends string>({ className, label, onChange, options, size = "md", value }: {
  className?: string;
  label: string;
  onChange: (value: Value) => void;
  options: SegmentedOption<Value>[];
  size?: "md" | "lg";
  value: Value;
}) {
  return (
    <SegmentedControl
      aria-label={label}
      className={cn("relative isolate inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-surface-pressed p-1 [scrollbar-width:none]", className)}
      onValueChange={(next) => { if (next !== null) onChange(next as Value); }}
      value={value}
    >
      <SegmentedControlIndicator className="absolute left-(--segmented-control-indicator-left) top-(--segmented-control-indicator-top) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-xl bg-surface shadow-[0_3px_0_var(--line-strong)] transition-[left,width] duration-[var(--motion-nav)] ease-[var(--ease-bounce)] motion-reduce:transition-none" />
      {options.map((option) => (
        <SegmentedControlItem
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl font-bold text-ink-muted outline-none transition-colors duration-[var(--motion-control)] hover:text-ink focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] data-checked:text-accent-ink",
            size === "lg" ? "h-11 px-5 text-[0.9375rem]" : "h-9 px-4 text-sm",
          )}
          key={option.value}
          value={option.value}
        >
          {option.icon ? <span aria-hidden className="inline-flex [&_svg]:size-4">{option.icon}</span> : null}
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
