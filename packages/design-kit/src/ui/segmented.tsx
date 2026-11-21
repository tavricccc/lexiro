import * as React from "react";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { cn } from "../lib/utils";

export interface SegmentedOption<Value extends string = string> {
  icon?: React.ReactNode;
  label: string;
  value: Value;
}

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
  return (
    <SegmentedControl
      aria-label={label}
      className={cn(
        "relative isolate inline-flex max-w-full items-stretch divide-x divide-line overflow-x-auto border border-line-strong bg-surface [scrollbar-width:none]",
        className,
      )}
      onValueChange={(next) => {
        if (next !== null) onChange(next as Value);
      }}
      value={value}
    >
      <SegmentedControlIndicator />
      {options.map((option) => (
        <SegmentedControlItem
          className={cn(
            "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none font-semibold tracking-[-0.01em] text-ink-muted outline-none transition-[color,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast data-checked:text-on-contrast data-disabled:opacity-40",
            size === "lg" ? "h-11 px-5 text-[0.9375rem]" : "h-9 px-3.5 text-sm",
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
