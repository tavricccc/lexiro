"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Every select in the app goes through here. Call sites pass a plain option
 * list instead of assembling a trigger, content and items each time, which is
 * what let native `<select>` elements creep back in across the feature pages.
 */
export function SelectField({
  ariaLabel,
  className,
  description,
  disabled,
  label,
  layout,
  onValueChange,
  options,
  placeholder,
  triggerClassName,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  description?: string;
  disabled?: boolean;
  label?: string;
  layout?: "stacked" | "row";
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  value: string;
}) {
  const control = (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel ?? label}
        className={cn("h-11 w-full", triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!label && !description) {
    return <div className={className}>{control}</div>;
  }

  return (
    <Field
      className={className}
      description={description}
      label={label}
      layout={layout}
    >
      {control}
    </Field>
  );
}
