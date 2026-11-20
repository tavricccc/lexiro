import { CaretDown, Check } from "@phosphor-icons/react/ssr";
import { Select as SelectRoot, SelectContent, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { cn } from "../lib/utils";
import { popupClass } from "./popup";

export interface SelectOption<Value extends string = string> {
  disabled?: boolean;
  label: string;
  value: Value;
}

export function Select<Value extends string>({ className, disabled, label, onChange, options, placeholder, value }: {
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  placeholder?: string;
  value: Value | "";
}) {
  return (
    <SelectRoot
      disabled={disabled}
      onValueChange={(next) => { if (typeof next === "string") onChange(next as Value); }}
      placeholder={placeholder}
      presentation="auto"
      value={value || null}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "inline-flex h-12 max-w-full cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 text-[0.9375rem] font-semibold text-ink shadow-[0_3px_0_var(--line-strong)] outline-none transition-[translate,box-shadow] duration-[var(--motion-touch)] active:translate-y-0.5 active:shadow-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] data-disabled:opacity-40",
          className,
        )}
      >
        <SelectValue className="min-w-0 truncate" />
        <CaretDown aria-hidden className="size-4 shrink-0 text-ink-muted" weight="bold" />
      </SelectTrigger>
      <SelectContent className={cn(popupClass, "max-h-[min(24rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto p-1.5")} sideOffset={8}>
        {options.map((option) => (
          <SelectItem
            className="flex h-12 cursor-pointer items-center gap-3 rounded-xl pl-3 pr-2 text-[0.9375rem] font-semibold outline-none data-disabled:opacity-40 data-highlighted:bg-surface-raised data-selected:text-accent-ink"
            disabled={option.disabled}
            key={option.value}
            label={option.label}
            value={option.value}
          >
            {option.label}
            <SelectItemIndicator className="ml-auto"><Check aria-hidden className="size-4" weight="bold" /></SelectItemIndicator>
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
