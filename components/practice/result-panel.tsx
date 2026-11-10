import Link from "@/components/ui/app-link";
import { useLearningStore } from "@/stores/learning-store";
import { calendarDay, streak } from "@/src/lib/learning-record";
import { Ring } from "@/components/redesign/primitives";
import { useLayoutEffect } from "react";

import { ParticleBurst } from "@/components/motion/particle-burst";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function ResultPanel({
  correct,
  total,
  skipped,
  marked,
  wrongContent,
  mode,
  onRetry,
  onRetryMarked,
  onNewRound,
}: {
  correct: number;
  total: number;
  skipped: number;
  marked: number;
  wrongContent: string;
  mode: "cards" | "questions" | "mixed";
  onRetry: () => void;
  onRetryMarked?: () => void;
  onNewRound?: () => void;
}) {
  // The result screen always opens at the top of the page.
  useLayoutEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, []);

  const record = useLearningStore((s) => s.record);
  const today = calendarDay(new Date());
  return (
    <div className="result pop-in" data-motion-view="practice-result">
      <section className="hero">
        <h1 className="t-section">{t("practice.resultTitle")}</h1>
        <Ring value={total ? (correct / total) * 100 : 0}>
          <div>
            <p className="fig">{correct}</p>
            <p>
              / {total} {t("redesign.countUnit")}
            </p>
          </div>
        </Ring>
        {total > 0 && correct / total >= 0.6 && (
          <ParticleBurst count={28} reach={150} />
        )}
        <div className="rowx">
          <span className="chip">
            {t("redesign.dayUnit")} {streak(record, today)}
          </span>
          <span className="chip">
            {t("redesign.dailyGoal")} {record.days[today]?.answered ?? 0} /{" "}
            {record.goal}
          </span>
        </div>
      </section>
      <div className="trio">
        <section className="tile tile-hue hue-mint">
          <p className="fig">
            {total ? Math.round((correct / total) * 100) : 0}
            <small>%</small>
          </p>
          <p>{t("redesign.accuracy")}</p>
        </section>
        <section className="tile tile-hue hue-sky">
          <p className="fig">{skipped}</p>
          <p>{t("practice.skippedLabel")}</p>
        </section>
        <section className="tile tile-hue hue-amber">
          <p className="fig">{marked}</p>
          <p>{t("practice.markedLabel")}</p>
        </section>
      </div>
      {wrongContent && (
        <Button size="lg" onClick={onRetry}>
          <Icons.retry />
          {t(
            mode === "cards"
              ? "practice.retryWords"
              : mode === "mixed"
                ? "practice.retryLearning"
                : "practice.retryWrong",
          )}
        </Button>
      )}
      {onRetryMarked && (
        <Button size="lg" variant="secondary" onClick={onRetryMarked}>
          {t("practice.retryMarked")}
        </Button>
      )}
      {onNewRound && (
        <Button size="lg" variant="secondary" onClick={onNewRound}>
          {t("practice.beginCount", { count: total })}
        </Button>
      )}
      <Link className="btn btn-lg btn-glass" href="/app">
        {t("practice.backHome")}
      </Link>
    </div>
  );
}
