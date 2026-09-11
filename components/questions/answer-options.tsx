"use client";

import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

/**
 * The four choices with the correct one marked in place. Both the single
 * question editor and each sub-question of a reading pack use this, so marking
 * an answer never means counting rows against a separate dropdown.
 */
export function AnswerOptions({
  answerIndex,
  error,
  labelPrefix = "",
  name,
  onAnswerChange,
  onOptionChange,
  options,
}: {
  answerIndex: number;
  error?: string | false;
  labelPrefix?: string;
  name: string;
  onAnswerChange: (index: number) => void;
  onOptionChange: (index: number, value: string) => void;
  options: string[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{t("questions.options")}</legend>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">
        {t("questions.correctHint")}
      </p>
      <div className="grid gap-2">
        {options.map((option, index) => (
          <label
            className={
              answerIndex === index
                ? "flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-400 bg-brand-50 px-3 py-2"
                : "flex items-center gap-3 rounded-[var(--radius-card)] border border-transparent px-3 py-2"
            }
            key={index}
          >
            <input
              aria-label={t("questions.markCorrect", { index: index + 1 })}
              checked={answerIndex === index}
              className="size-4 shrink-0 accent-[var(--brand-600)]"
              name={name}
              onChange={() => onAnswerChange(index)}
              type="radio"
            />
            <span
              aria-hidden
              className="w-4 shrink-0 text-sm text-muted-foreground"
            >
              {index + 1}
            </span>
            <Input
              aria-label={`${labelPrefix}${t("questions.optionLabel", { index: index + 1 })}`}
              className="bg-card"
              onChange={(event) => onOptionChange(index, event.target.value)}
              placeholder={t("questions.optionLabel", { index: index + 1 })}
              value={option}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
