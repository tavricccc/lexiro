"use client";

import type { LucideIcon } from "lucide-react";

import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export interface Choice {
  /** Why someone would pick this, in their words, not the system's. */
  description: string;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  /** The one number that decides the choice — how much is waiting here. */
  meta?: string;
  /** True when `meta` reports an absence, so it must not read as a score. */
  metaEmpty?: boolean;
  value: string;
}

/**
 * A branch point rendered as full-width rows instead of a select or a tab bar.
 *
 * A select hides the alternatives until you open it and gives no room to say
 * what each one is; a tab bar implies the two sides are views of one thing. A
 * branch that changes what the rest of the screen asks for is neither, so it
 * gets its own step: every option visible at once, each with the sentence that
 * makes the choice obvious, and nothing else on screen competing with it.
 *
 * The rows share the hairline rhythm of the library listing rather than
 * becoming a stack of bordered cards, because a column of identical cards is
 * the one shape this app's structure is deliberately not built from.
 */
export function ChoiceList({
  onSelect,
  options,
  value,
}: {
  onSelect: (value: string) => void;
  options: Choice[];
  /** Set when the list stays on screen after the choice, as a stepper recap. */
  value?: string;
}) {
  return (
    <div className="divide-y border-y">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            aria-current={active ? "true" : undefined}
            className={cn(
              "group flex w-full items-start gap-4 py-5 text-left transition-colors duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45",
              active && "bg-brand-50",
            )}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            {option.icon && (
              <option.icon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-brand-600"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-lexical text-lg font-medium leading-snug group-hover:text-primary">
                  {option.label}
                </span>
                {option.meta && (
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      option.metaEmpty
                        ? "text-muted-foreground"
                        : "text-brand-600",
                    )}
                  >
                    {option.meta}
                  </span>
                )}
              </span>
              <span className="mt-1 block max-w-[58ch] text-sm leading-6 text-muted-foreground">
                {option.description}
              </span>
            </span>
            <Icons.next
              aria-hidden
              className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-quick)] group-hover:translate-x-0.5"
            />
          </button>
        );
      })}
    </div>
  );
}
