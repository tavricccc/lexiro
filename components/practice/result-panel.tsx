import Link from "@/components/ui/app-link";
import { useLayoutEffect } from "react";

import { motion } from "motion/react";

import { CountUp } from "@/components/motion/animated-number";
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

  return (
    <div
      data-motion-view="practice-result"
      className="mx-auto grid w-full max-w-xl gap-7 py-6 sm:py-8"
    >
      {/* The one green field of the session, ink on it as on the printed card. */}
      <motion.section
        animate={{ opacity: 1, scale: 1 }}
        className="grid gap-1.5 rounded-[var(--radius-stage)] bg-[#7cc49c] p-6 pt-[1.375rem] text-[#13201a]"
        initial={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
      >
        <h1 className="type-section">{t("practice.resultTitle")}</h1>
        <p className="relative w-fit text-[8rem] font-extrabold leading-[8.25rem] tracking-[-0.05em] tabular-nums">
          <CountUp from={0} value={correct} />
          <span className="text-4xl font-bold tracking-[-0.03em]">
            {" "}
            / {total}
          </span>
          {/* A good round is celebrated once, from the score, as in the app. */}
          {total > 0 && correct / total >= 0.6 && (
            <ParticleBurst count={28} reach={150} />
          )}
        </p>
        <div aria-hidden className="mt-1 flex flex-wrap gap-1.5">
          {Array.from({ length: total }, (_, index) => (
            <motion.span
              animate={{ opacity: 1, scale: 1 }}
              initial={{ opacity: 0, scale: 0.4 }}
              transition={{ delay: 0.16 + Math.min(index, 30) * 0.024 }}
              key={index}
              className={
                index < correct
                  ? "h-3.5 w-[1.3125rem] rounded-full border-2 border-[#13201a] bg-[#13201a]"
                  : "h-3.5 w-[1.3125rem] rounded-full border-2 border-[#13201a]"
              }
            />
          ))}
        </div>
        <dl className="mt-3.5 flex gap-7">
          {[
            [t("practice.skippedLabel"), skipped],
            [t("practice.markedLabel"), marked],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="type-hint text-[#13201a]">{label}</dt>
              <dd className="text-[1.75rem] font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </motion.section>

      <div className="grid gap-2.5">
        {wrongContent && (
          <Button className="w-full" size="lg" onClick={onRetry}>
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
          <Button
            className="w-full"
            size="lg"
            variant="secondary"
            onClick={onRetryMarked}
          >
            <Icons.mark />
            {t("practice.retryMarked")}
          </Button>
        )}
        {onNewRound && (
          <Button
            className="w-full"
            size="lg"
            variant={wrongContent ? "secondary" : "default"}
            onClick={onNewRound}
          >
            <Icons.refresh />
            再一輪
          </Button>
        )}
        <Button asChild className="w-full" size="lg" variant="ghost">
          <Link href="/app">{t("practice.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
