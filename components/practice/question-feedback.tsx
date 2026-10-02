import { motion } from "motion/react";
import type { QuestionItem } from "./practice-content";
import { isCorrectChoice } from "./meaning-questions";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { timing } from "@/lib/motion-timing";

export function QuestionFeedback({
  item,
  selected,
}: {
  item: QuestionItem;
  selected: number;
}) {
  const correct = isCorrectChoice(item, selected);
  const wrongReason = !correct
    ? item.whyWrong?.[item.options[selected]]
    : undefined;
  return (
    <motion.div
      className="mt-6 rule-t pt-5"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      transition={timing("control", "arrive")}
      aria-live="polite"
    >
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          correct ? "text-success" : "text-destructive",
        )}
      >
        {correct ? (
          <Icons.success aria-hidden className="size-4" />
        ) : (
          <Icons.incorrect aria-hidden className="size-4" />
        )}
        {correct ? t("practice.correct") : t("practice.incorrect")}
      </p>
      {!correct && (
        <p className="mt-2 text-sm leading-6">
          {t("practice.answer", { answer: item.options[item.answerIndex] })}
        </p>
      )}
      {wrongReason && (
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {wrongReason}
        </p>
      )}
      {item.explanation && (
        <p className="mt-3 whitespace-pre-line text-sm leading-7">
          {item.explanation}
        </p>
      )}
      {item.question?.kind !== "reading" &&
        item.meaning &&
        (item.type !== "meaning" ||
          (item.acceptedMeanings?.length ?? 0) > 1) && (
          <p className="mt-3 text-sm text-muted-foreground">{item.meaning}</p>
        )}
    </motion.div>
  );
}
