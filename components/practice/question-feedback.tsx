import { motion } from "motion/react";
import type { QuestionItem } from "./practice-content";
import { isCorrectChoice, isWordTask } from "./meaning-questions";
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
  const optionReasons = optionNotes(item);
  const answerMeaning =
    item.type === "vocabulary" || item.type === "wordBank" ? item.meaning : "";
  return (
    <motion.div
      className="mt-6 grid gap-3 rounded-[var(--radius-card)] bg-card p-5"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      transition={timing("control", "arrive")}
      aria-live="polite"
    >
      <p
        className={cn(
          "t-result-in flex items-center gap-2 text-[0.9375rem] font-bold",
          correct ? "text-success" : "text-destructive",
        )}
      >
        {correct ? (
          <Icons.success aria-hidden className="t-answer-mark size-4" />
        ) : (
          <Icons.incorrect aria-hidden className="t-answer-mark size-4" />
        )}
        {correct ? t("practice.correct") : t("practice.incorrect")}
      </p>
      <p className="text-base font-semibold leading-6">
        {t("practice.answer", { answer: item.options[item.answerIndex] })}
        {answerMeaning && (
          <span className="ml-2 font-normal text-muted-foreground">{answerMeaning}</span>
        )}
      </p>
      {item.explanation && (
        <p className="whitespace-pre-line text-base leading-7">
          {item.explanation}
        </p>
      )}
      {optionReasons.length > 0 && (
        <section className="mt-1" aria-label={t("practice.optionReasons")}>
          <h2 className="text-[0.8125rem] font-semibold text-muted-foreground">
            {t("practice.optionReasons")}
          </h2>
          <dl className="mt-2 grid gap-2.5">
            {optionReasons.map(({ option, index, gloss, note }) => (
              <div key={option} className="min-w-0">
                <dt className="break-words text-base leading-6">
                  <span className="mr-2 text-muted-foreground">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                  {gloss && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {gloss}
                    </span>
                  )}
                </dt>
                {note && (
                  <dd className="mt-0.5 whitespace-pre-line break-words text-[0.8125rem] leading-6 text-muted-foreground">
                    {note}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}
      {item.type === "meaning" &&
        item.meaning &&
        (item.acceptedMeanings?.length ?? 0) > 1 && (
          <p className="text-[0.8125rem] text-muted-foreground">{item.meaning}</p>
        )}
    </motion.div>
  );
}

const GLOSS_LIMIT = 16;

/** Splits a stored reason into an inline meaning and an optional short note. */
function splitOptionReason(reason: string): {
  gloss?: string;
  note?: string;
} {
  const text = reason.trim();
  // Older generations wrapped each meaning in a repeated "does not fit" clause.
  const legacy = /意為「([^」]+)」/.exec(text);
  if (legacy) return { gloss: legacy[1] };
  const [head, ...rest] = text.split("；");
  if (rest.length && head.length <= GLOSS_LIMIT)
    return { gloss: head, note: rest.join("；") };
  if (text.length <= GLOSS_LIMIT && !/[。，]/.test(text))
    return { gloss: text };
  return { note: text };
}

/** Option notes by display order; shared banks show only what each blank needs. */
function optionNotes(item: QuestionItem) {
  const group = item.question?.kind === "reading" ? item.question : null;
  const used = new Set(
    group?.questions.map((child) => child.options[child.answerIndex]) ?? [],
  );
  return item.options.flatMap((option, index) => {
    const reason = item.whyWrong?.[option];
    if (!reason || isCorrectChoice(item, index)) return [];
    // A discourse bank's own answers are explained at their blanks.
    if (item.type === "discourse" && used.has(option)) return [];
    // A word task's reason is the option's own meaning, never a sentence.
    if (isWordTask(item.type)) return [{ option, index, gloss: reason }];
    const parts = splitOptionReason(reason);
    // Older word-bank sets carry nine long reasons per blank; keep the meanings.
    if (item.type === "wordBank" && !parts.gloss) return [];
    return [{ option, index, ...parts }];
  });
}
