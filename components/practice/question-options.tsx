import type { QuestionItem } from "./practice-content";
import { usedBlankForOption } from "./practice-content";
import type { AnsweredBlank } from "./passage-view";
import { t } from "@/lib/i18n";
import { isCorrectChoice } from "./meaning-questions";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function QuestionOptions({
  item,
  selected,
  pendingChoice,
  readOnly,
  onAnswer,
  answeredBlanks,
}: {
  item: QuestionItem;
  selected: number | null;
  pendingChoice: number | null;
  /** A question revisited after it was answered or skipped. */
  readOnly: boolean;
  onAnswer: (choice: number) => void;
  answeredBlanks: Record<number, AnsweredBlank>;
}) {
  const answered = selected !== null;
  return (
    <div
      className={cn(
        "mt-5 grid gap-2.5",
        item.options.length > 5 && "sm:grid-cols-2",
      )}
    >
      {item.options.map((option, optionIndex) => {
        const usedBlank = usedBlankForOption(item, optionIndex, answeredBlanks);
        const isCorrect = isCorrectChoice(item, optionIndex);
        const isSelected = selected === optionIndex;
        const isPending = !answered && pendingChoice === optionIndex;
        const stateClass =
          answered && isCorrect
            ? "border-transparent bg-success/12"
            : answered && isSelected
              ? "border-transparent bg-destructive/12"
              : isPending
                ? "border-primary bg-[var(--brand-50)]"
                : usedBlank !== undefined
                  ? "border-transparent bg-muted/30 text-muted-foreground"
                  : answered
                    ? "border-transparent bg-card opacity-60"
                    : "border-transparent bg-card hover:border-primary/40";
        const badgeClass =
          answered && isCorrect
            ? "bg-success text-success-foreground"
            : answered && isSelected
              ? "bg-destructive text-destructive-foreground"
              : isPending
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground";
        // Only an answer given just now animates; a revisited one is still.
        const result =
          !answered || readOnly
            ? undefined
            : isSelected
              ? isCorrect
                ? "correct"
                : "wrong"
              : isCorrect
                ? "revealed"
                : undefined;
        return (
          <button
            key={`${item.id}:${optionIndex}`}
            type="button"
            data-practice-option
            data-result={result}
            disabled={answered || readOnly || usedBlank !== undefined}
            aria-pressed={isSelected || isPending}
            onClick={() => onAnswer(optionIndex)}
            className={cn(
              "t-answer flex min-h-16 w-full items-center gap-3.5 rounded-[var(--radius-control)] border-2 px-4 py-3.5 text-left text-[1.0625rem] text-foreground transition-colors duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default",
              stateClass,
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                badgeClass,
              )}
            >
              {String.fromCharCode(65 + optionIndex)}
            </span>
            <span className="min-w-0 flex-1 break-words leading-6">
              {option}
              {usedBlank !== undefined && (
                <span className="block text-sm text-muted-foreground">
                  {t("practice.usedInBlank", { index: usedBlank })}
                </span>
              )}
            </span>
            {answered && isCorrect && (
              <Icons.success
                aria-hidden
                className={cn(
                  "size-4 shrink-0 text-success",
                  !readOnly && "t-answer-mark",
                )}
              />
            )}
            {answered && isSelected && !isCorrect && (
              <Icons.incorrect
                aria-hidden
                className={cn(
                  "size-4 shrink-0 text-destructive",
                  !readOnly && "t-answer-mark",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
