import * as React from "react";
import { CaretDown, Check } from "@phosphor-icons/react/ssr";
import { Select as SelectPrimitive } from "radix-ui";
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
    <SelectPrimitive.Root disabled={disabled} onValueChange={(next) => onChange(next as Value)} value={value || undefined}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          renderTrigger
            ? "outline-none"
            : "inline-flex h-11 max-w-full items-center gap-2 rounded-none border border-line-strong/35 bg-surface px-3.5 text-[0.9375rem] font-medium text-ink outline-none transition-[border-color,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:border-line-strong focus-visible:border-contrast focus-visible:ring-1 focus-visible:ring-contrast disabled:opacity-40",
          className,
        )}
      >
        {renderTrigger ? renderTrigger(selected) : (
          <>
            <span className={cn("min-w-0 truncate", !selected && "text-ink-faint")}>{selected?.label ?? placeholder}</span>
            <CaretDown aria-hidden className="size-4 shrink-0 text-ink-muted" weight="bold" />
          </>
        )}
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="float-surface z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-none border-2 border-line-strong bg-surface-solid text-ink shadow-float"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="divide-y divide-line">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="flex h-11 cursor-pointer items-center gap-3 px-3.5 text-[0.9375rem] font-medium outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-contrast data-[highlighted]:text-on-contrast"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check aria-hidden className="size-4" weight="bold" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
