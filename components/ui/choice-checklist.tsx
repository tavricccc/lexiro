"use client";

import type { LucideIcon } from "lucide-react";

import { ListCheckRow } from "@/components/ui/list";

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
 * It is the grouped list's own check row, so picking three of six formats is
 * drawn exactly like picking one of two tracks: same gutter, same hairlines,
 * same alignment, and the checkbox on the same edge as the check it replaces.
 * The row stays a whole hit target, so the checkbox never has to be aimed at.
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
      {options.map((option) => (
        <ListCheckRow
          checked={selected.includes(option.value)}
          detail={option.description}
          icon={option.icon}
          key={option.value}
          label={option.label}
          onCheckedChange={(checked) => onToggle(option.value, checked)}
          value={option.meta}
        />
      ))}
    </div>
  );
}
