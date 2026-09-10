"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export interface GenerationSense {
  covered: boolean;
  key: string;
  meaning: string;
  pos: string;
  word: string;
}

/**
 * Picking which senses to generate from is opt-in: everything in scope is
 * selected by default and the list stays folded away, so the common case is one
 * button press rather than a round of ticking boxes.
 */
export function GenerationScopePicker({
  onSelectedChange,
  selected,
  senses,
}: {
  onSelectedChange: (keys: string[]) => void;
  selected: string[];
  senses: GenerationSense[];
}) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(selected);
  const uncovered = senses.filter((sense) => !sense.covered);

  const toggle = (key: string, checked: boolean) =>
    onSelectedChange(
      checked ? [...selected, key] : selected.filter((value) => value !== key),
    );

  return (
    <section className="rounded-[var(--radius-card)] border bg-card">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-5"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {t("questions.scopeTitle")}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {selected.length === senses.length
              ? t("questions.scopeAll", { count: senses.length })
              : t("questions.scopeSome", {
                  count: selected.length,
                  total: senses.length,
                })}
          </span>
        </span>
        <Icons.open
          aria-hidden
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-quick)] ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="t-panel-reveal border-t">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelectedChange(senses.map((sense) => sense.key))}
            >
              {t("questions.selectAll")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!uncovered.length}
              onClick={() =>
                onSelectedChange(uncovered.map((sense) => sense.key))
              }
            >
              {t("questions.selectUncovered", { count: uncovered.length })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelectedChange([])}
            >
              {t("questions.clear")}
            </Button>
          </div>
          <ul className="max-h-[26rem] divide-y overflow-y-auto">
            {senses.map((sense) => (
              <li key={sense.key}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] sm:px-5">
                  <Checkbox
                    checked={chosen.has(sense.key)}
                    className="mt-1"
                    onCheckedChange={(checked) =>
                      toggle(sense.key, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-lexical text-base font-medium">
                        {sense.word}
                      </span>
                      <span className="entry-pos text-sm">{sense.pos}</span>
                      {sense.covered && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {t("questions.alreadyCovered")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {sense.meaning}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
