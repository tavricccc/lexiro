import type { QuestionItem } from "./practice-content";
import { usedBlankForOption } from "./practice-content";
import type { AnsweredBlank } from "./passage-view";
import { t } from "@/lib/i18n";
import { isCorrectChoice } from "./meaning-questions";
import { ParticleBurst } from "@/components/motion/particle-burst";
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
        "opts mt-5",
        item.options.length > 5 && "sm:grid-cols-2",
      )}
    >
      {item.options.map((option, optionIndex) => {
        const usedBlank = usedBlankForOption(item, optionIndex, answeredBlanks);
        const isCorrect = isCorrectChoice(item, optionIndex);
        const isSelected = selected === optionIndex;
        const isPending = !answered && pendingChoice === optionIndex;
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
            className="opt relative"
            data-state={answered ? isCorrect ? "right" : isSelected ? "wrong" : "dim" : undefined}
            aria-checked={isPending || isSelected}
          >
            <kbd>{String.fromCharCode(65 + optionIndex)}</kbd>
            <span className="min-w-0 flex-1 break-words leading-6">
              {option}
              {usedBlank !== undefined && (
                <span className="block text-sm text-muted-foreground">
                  {t("practice.usedInBlank", { index: usedBlank })}
                </span>
              )}
            </span>
            {/* The learner's own right pick is celebrated, as in the app. */}
            {result === "correct" && <ParticleBurst />}
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
