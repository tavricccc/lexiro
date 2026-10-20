"use client";

import Link from "@/components/ui/app-link";
import { useLayoutEffect } from "react";

import { CountUp } from "@/components/motion/animated-number";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
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
}: {
  correct: number;
  total: number;
  skipped: number;
  marked: number;
  wrongContent: string;
  mode: "cards" | "questions" | "mixed";
  onRetry: () => void;
  onRetryMarked?: () => void;
}) {
  // The result screen always opens at the top of the page.
  useLayoutEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, []);

  return (
    <div
      data-motion-view="practice-result"
      className="mx-auto flex w-full max-w-xl flex-col py-6 sm:py-8"
    >
      <header className="page-header mb-4 hidden md:block">
        <div className="page-title-row flex items-center gap-3">
          <h1 className="type-page flex-1">{t("practice.resultTitle")}</h1>
          <div className="page-action-host flex" data-page-actions-host />
        </div>
      </header>
      <div className="study-finish text-center">
        <Icons.success
          className="t-celebrate mx-auto mb-6 size-10"
          aria-hidden
        />
        <h1 className="mb-5 type-page md:hidden">
          {t("practice.resultTitle")}
        </h1>
        <p className="text-[3.5rem] font-medium leading-none tabular-nums">
          <CountUp from={0} value={correct} />
          <span className="study-finish-total">/{total}</span>
        </p>
        <p className="mt-3 text-sm">{t("practice.resultHint")}</p>
        <dl className="mt-4 flex justify-center gap-8 text-sm">
          <div>
            <dt>{t("practice.skippedLabel")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{skipped}</dd>
          </div>
          <div>
            <dt>{t("practice.markedLabel")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{marked}</dd>
          </div>
        </dl>
      </div>

      <StepActions>
        <Button asChild className="w-full" size="lg">
          <Link href="/app">
            <Icons.review />
            {t("practice.backHome")}
          </Link>
        </Button>
        {wrongContent && (
          <Button className="w-full" variant="secondary" onClick={onRetry}>
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
            variant="secondary"
            onClick={onRetryMarked}
          >
            <Icons.mark />
            {t("practice.retryMarked")}
          </Button>
        )}
      </StepActions>
    </div>
  );
}
