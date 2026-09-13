"use client";

import { Button } from "@/components/ui/button";
import { ListCheckRow } from "@/components/ui/list";
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
      {/* The card owns the gutter, so this row must not add one of its own:
          padding here started the buttons further in than the words below. */}
      <div className="-mx-2 flex flex-wrap items-center gap-1 py-2">
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
      {senses.map((sense) => (
        <ListCheckRow
          checked={chosen.has(sense.key)}
          detail={sense.meaning}
          key={sense.key}
          label={
            <span className="flex items-baseline gap-2">
              <span className="truncate">{sense.word}</span>
              <span className="entry-pos text-sm">{sense.pos}</span>
            </span>
          }
          onCheckedChange={(checked) => toggle(sense.key, checked)}
          value={sense.covered ? t("questions.alreadyCovered") : undefined}
        />
      ))}
    </section>
  );
}
