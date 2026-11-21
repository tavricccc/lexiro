import * as React from "react";
import { CaretDown, Check } from "@phosphor-icons/react/ssr";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { cn } from "../lib/utils";

export interface SelectOption<Value extends string = string> {
  disabled?: boolean;
  label: string;
  value: Value;
}

export function Select<Value extends string>({
  className,
  disabled,
  label,
  onChange,
  options,
  placeholder,
  renderTrigger,
  value,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  placeholder?: string;
  renderTrigger?: (selected: SelectOption<Value> | undefined) => React.ReactNode;
  value: Value | "";
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <UISelect
      disabled={disabled}
      items={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next as Value);
      }}
      placeholder={placeholder}
      value={value || null}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          renderTrigger
            ? "outline-none"
            : "inline-flex h-11 max-w-full cursor-pointer items-center justify-between gap-2 rounded-none border border-line-strong/35 bg-surface px-3.5 text-[0.9375rem] font-medium text-ink outline-none transition-[border-color,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:border-line-strong focus-visible:border-contrast focus-visible:ring-1 focus-visible:ring-contrast data-open:border-contrast data-disabled:opacity-40",
          className,
        )}
      >
        {renderTrigger ? renderTrigger(selected) : (
          <>
            <SelectValue className="min-w-0 truncate data-placeholder:text-ink-faint" />
            <CaretDown aria-hidden className="size-4 shrink-0 text-ink-muted" weight="bold" />
          </>
        )}
      </SelectTrigger>
      <SelectContent
        className="z-50 max-h-[min(24rem,var(--available-height,24rem))] min-w-[var(--anchor-width)] divide-y divide-line overflow-y-auto rounded-none border-2 border-line-strong bg-surface-solid p-0 text-ink shadow-float outline-none transition-[opacity,scale] duration-[var(--motion-control)] data-starting-style:opacity-0 data-starting-style:scale-[0.985] data-ending-style:opacity-0 data-ending-style:scale-[0.985]"
        sideOffset={4}
      >
        {options.map((option) => (
          <SelectItem
            className="flex h-11 cursor-pointer items-center gap-3 px-3.5 text-[0.9375rem] font-medium outline-none data-disabled:opacity-40 data-highlighted:bg-contrast data-highlighted:text-on-contrast"
            disabled={option.disabled}
            key={option.value}
            label={option.label}
            value={option.value}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <SelectItemIndicator className="ml-auto shrink-0">
              <Check aria-hidden className="size-4" weight="bold" />
            </SelectItemIndicator>
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  );
}
