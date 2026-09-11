"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Markdown } from "@/components/ui/markdown";
import { t } from "@/lib/i18n";
import { generateWithSavedAi, isAiConfigured } from "@/src/lib/ai-provider";
import { buildMistakeExplanationPrompt } from "@/src/lib/prompts";

export function ResultPanel({
  correct,
  total,
  skipped,
  marked,
  wrongContent,
  onRetry,
  onRetryMarked,
  onContinueQuestions,
}: {
  correct: number;
  total: number;
  skipped: number;
  marked: number;
  wrongContent: string;
  onRetry: () => void;
  onRetryMarked?: () => void;
  onContinueQuestions?: () => void;
}) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const explain = async () => {
    setBusy(true);
    setError("");
    try {
      setExplanation(
        await generateWithSavedAi(buildMistakeExplanationPrompt(wrongContent), {
          responseFormat: "text",
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="mx-auto max-w-xl py-10 sm:py-14"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="text-center">
        <p className="text-[3.5rem] font-medium leading-none tabular-nums">
          {correct}
          <span className="text-muted-foreground">/{total}</span>
        </p>
        <h1 className="mt-4 text-lg font-medium">{t("practice.resultTitle")}</h1>
        <dl className="mt-4 flex justify-center gap-8 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("practice.skippedLabel")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{skipped}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("practice.markedLabel")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{marked}</dd>
          </div>
        </dl>
      </div>

      <div className="section-gap flex flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
        {onContinueQuestions ? (
          <Button onClick={onContinueQuestions}>
            <Icons.start />
            {t("practice.continueQuestions")}
          </Button>
        ) : (
          <Button asChild>
            <Link href="/">
              <Icons.review />
              {t("practice.backHome")}
            </Link>
          </Button>
        )}
        {wrongContent && (
          <Button variant="secondary" onClick={onRetry}>
            <Icons.retry />
            {t("practice.retryWrong")}
          </Button>
        )}
        {onRetryMarked && (
          <Button variant="secondary" onClick={onRetryMarked}>
            <Icons.mark />
            {t("practice.retryMarked")}
          </Button>
        )}
      </div>

      {wrongContent && !explanation && (
        <div className="mt-6 flex justify-center">
          {isAiConfigured() ? (
            <Button variant="ghost" disabled={busy} onClick={() => void explain()}>
              <Icons.generate />
              {t(busy ? "practice.explaining" : "practice.explainWrong")}
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href="/me">
                <Icons.ai />
                {t("ai.setUp")}
              </Link>
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
        </p>
      )}
      {explanation && (
        <section className="section-gap rule-t pt-6">
          <h2 className="type-section">
            {t("practice.explanationTitle")}
          </h2>
          <Markdown className="mt-4 text-sm" content={explanation} />
        </section>
      )}
    </motion.div>
  );
}
