"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";

export interface GenerationSense {
  covered: boolean;
  key: string;
  meaning: string;
  pos: string;
  word: string;
}

/**
 * This is the one job of the scope step. Everything is selected by default, but
 * the full list stays visible so selecting a subset never expands a different
 * page underneath the user's thumb.
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
  const chosen = new Set(selected);
  const uncovered = senses.filter((sense) => !sense.covered);

  const toggle = (key: string, checked: boolean) =>
    onSelectedChange(
      checked ? [...selected, key] : selected.filter((value) => value !== key),
    );

  return (
    <section className="rule-card rule-list">
      <div className="flex flex-wrap items-center gap-2 rule-b px-4 py-3 sm:px-5">
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
          onClick={() => onSelectedChange(uncovered.map((sense) => sense.key))}
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
      <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">
        {selected.length === senses.length
          ? t("questions.scopeAll", { count: senses.length })
          : t("questions.scopeSome", {
              count: selected.length,
              total: senses.length,
            })}
      </p>
      <ul>
        {senses.map((sense) => (
          <li key={sense.key}>
            <label className="flex min-h-[3.25rem] cursor-pointer items-start gap-3 px-4 py-[var(--row-padding-block)] hover:bg-[var(--surface-hover)] sm:px-5">
              <Checkbox
                checked={chosen.has(sense.key)}
                className="mt-1"
                onCheckedChange={(checked) =>
                  toggle(sense.key, checked === true)
                }
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-medium">{sense.word}</span>
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
    </section>
  );
}
