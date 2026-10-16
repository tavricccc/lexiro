"use client";

import { PassageView } from "@/components/practice/passage-view";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { RoomReview } from "@/lib/room-client";

/** Your wrong and missed questions, each with the answer and explanation. */
export function Review({ review }: { review: RoomReview }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-card p-5">
      <h2 className="type-section">{t("rooms.review")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {review.items.length
          ? t("rooms.reviewCount", { count: review.items.length })
          : t("rooms.reviewEmpty")}
      </p>
      <ol className="mt-4 space-y-6">
        {review.items.map((item, order) => {
          const passage = item.question.passageId
            ? review.passages[item.question.passageId]
            : undefined;
          return (
            <li
              key={item.index}
              className="t-result-in space-y-3"
              // The first few arrive in turn after the ranking; the rest are
              // below the fold and simply arrive with the last of them.
              style={{
                animationDelay: `calc(var(--motion-control) + ${Math.min(order, 4)} * var(--motion-touch) / 2)`,
              }}
            >
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("rooms.reviewItem", { number: item.index + 1 })}
                {item.choice === null && ` · ${t("rooms.missed")}`}
              </p>
              {passage && (
                <details className="rounded-[var(--radius-control)] bg-muted/40 px-4 py-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    {t("rooms.showPassage")} · {passage.title}
                  </summary>
                  <div className="mt-3">
                    <PassageView
                      activeBlank={item.question.blank}
                      passage={passage.text}
                    />
                  </div>
                </details>
              )}
              <p className="question-text font-semibold leading-7">
                {item.question.blank
                  ? t("questions.blankLabel", { index: item.question.blank })
                  : item.question.prompt}
              </p>
              <ul className="grid gap-2">
                {item.question.options.map((option, index) => {
                  const accepted = item.accepted.includes(index);
                  const chosen = item.choice === index;
                  if (!accepted && !chosen) return null;
                  return (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-3 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm",
                        accepted
                          ? "border-success/40 bg-success/10"
                          : "border-destructive/40 bg-destructive/10",
                      )}
                    >
                      <span className="font-semibold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {option}
                        {chosen && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t("rooms.yourAnswer")}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {item.explanation && (
                <p className="rounded-[var(--radius-control)] bg-muted/50 p-4 text-sm leading-6">
                  {item.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
