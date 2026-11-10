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

      <div className="grid gap-2">
        {options.map((option, index) => (
          <label
            className={
              answerIndex === index
                ? "answer-edit-row answer-edit-selected"
                : "answer-edit-row"
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
              {String.fromCharCode(65 + index)}
            </span>
            <Input
              aria-label={`${labelPrefix}${t("questions.optionLabel", { index: index + 1 })}`}
              className="min-h-11 bg-card text-base"
              name={`${name}-option-${index}`}
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
