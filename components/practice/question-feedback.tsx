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
  const optionReasons = item.options.flatMap((option, index) => {
    const reason = item.whyWrong?.[option];
    return reason && !isCorrectChoice(item, index)
      ? [{ option, index, reason }]
      : [];
  });
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
      <p className="mt-2 text-sm leading-6">
        {t("practice.answer", { answer: item.options[item.answerIndex] })}
      </p>
      {item.explanation && (
        <p className="mt-3 whitespace-pre-line text-sm leading-7">
          {item.explanation}
        </p>
      )}
      {optionReasons.length > 0 && (
        <section className="mt-4" aria-label={t("practice.optionReasons")}>
          <h2 className="text-sm font-semibold">
            {t("practice.optionReasons")}
          </h2>
          <dl className="mt-3 grid gap-3">
            {optionReasons.map(({ option, index, reason }) => (
              <div key={option} className="min-w-0">
                <dt className="break-words text-sm font-medium leading-6">
                  <span className="mr-2 text-muted-foreground">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </dt>
                <dd className="mt-1 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">
                  {reason}
                </dd>
              </div>
            ))}
          </dl>
        </section>
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
