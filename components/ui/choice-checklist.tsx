"use client";

import type { LucideIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

export interface ChecklistChoice {
  description: string;
  icon?: LucideIcon;
  label: string;
  /** The one number that decides the choice — how much is waiting here. */
  meta?: string;
  value: string;
}

/**
 * `ChoiceList` for a question that takes more than one answer.
 *
 * It keeps that component's rows exactly — same gutter, same hairlines, same
 * icon and lead — because picking three of six formats and picking one of two
 * tracks are the same kind of reading task; only the commitment differs. The
 * chevron becomes a checkbox, and the row stays a whole hit target so the
 * checkbox never has to be aimed at.
 */
export function ChoiceChecklist({
  onToggle,
  options,
  selected,
}: {
  onToggle: (value: string, checked: boolean) => void;
  options: ChecklistChoice[];
  selected: readonly string[];
}) {
  return (
    <div className="rule-card rule-list">
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            className={cn(
              "t-row group flex w-full cursor-pointer items-start gap-4 py-5 text-left",
              checked && "bg-brand-50",
            )}
            key={option.value}
          >
            {option.icon && (
              <option.icon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-brand-600"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="type-subsection">{option.label}</span>
                {option.meta && (
                  <span className="text-sm tabular-nums text-brand-600">
                    {option.meta}
                  </span>
                )}
              </span>
              <span className="mt-1 block max-w-[58ch] type-lead">
                {option.description}
              </span>
            </span>
            <Checkbox
              checked={checked}
              className="mt-1.5 shrink-0"
              onCheckedChange={(next) => onToggle(option.value, next === true)}
            />
          </label>
        );
      })}
    </div>
  );
}
