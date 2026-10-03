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
  busy,
  onAnswer,
  answeredBlanks,
}: {
  item: QuestionItem;
  selected: number | null;
  pendingChoice: number | null;
  busy: boolean;
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
            ? "border-success/40 bg-success/10"
            : answered && isSelected
              ? "border-destructive/40 bg-destructive/10"
              : isPending
                ? "border-primary bg-primary/10"
                : usedBlank !== undefined
                  ? "border-border/70 bg-muted/30 text-muted-foreground"
                  : "border-border/70 bg-card hover:border-primary/50 hover:bg-primary/5";
        const badgeClass =
          answered && isCorrect
            ? "bg-success text-success-foreground"
            : answered && isSelected
              ? "bg-destructive text-destructive-foreground"
              : isPending
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground";
        return (
          <button
            key={`${item.id}:${optionIndex}`}
            type="button"
            disabled={answered || busy || usedBlank !== undefined}
            aria-pressed={isSelected || isPending}
            onClick={() => onAnswer(optionIndex)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left text-base transition-colors duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default",
              stateClass,
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
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
            {isPending && (
              <Icons.loading
                aria-hidden
                className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              />
            )}
            {answered && isCorrect && (
              <Icons.success
                aria-hidden
                className="size-4 shrink-0 text-success"
              />
            )}
            {answered && isSelected && !isCorrect && (
              <Icons.incorrect
                aria-hidden
                className="size-4 shrink-0 text-destructive"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
