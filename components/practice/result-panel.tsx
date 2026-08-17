"use client";

import { Bookmark, Check, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { AiActions } from "@/components/ai/ai-actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { buildMistakeExplanationPrompt } from "@/src/lib/prompts";

const resultTransition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

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
  const prompt = buildMistakeExplanationPrompt(wrongContent);

  return (
    <motion.div
      className="mx-auto max-w-xl py-10 text-center sm:py-14"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={resultTransition}
    >
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
        <Check className="size-5" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em]">{t("practice.resultTitle")}</h1>
      <p className="mt-3 text-base font-semibold tabular-nums">{t("practice.score", { correct, total })}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("practice.skipped", { count: skipped })} · {t("practice.marked", { count: marked })}
      </p>

      <div className="mx-auto mt-7 flex max-w-md flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
        {onContinueQuestions ? (
          <Button onClick={onContinueQuestions}>{t("practice.continueQuestions")}</Button>
        ) : (
          <Button asChild><Link href="/">{t("practice.backHome")}</Link></Button>
        )}
        {wrongContent && (
          <Button variant="secondary" onClick={onRetry}>
            <RotateCcw className="size-4" />{t("practice.retryWrong")}
          </Button>
        )}
        {onRetryMarked && (
          <Button variant="secondary" onClick={onRetryMarked}>
            <Bookmark className="size-4" />{t("practice.retryMarked")}
          </Button>
        )}
      </div>

      {wrongContent && (
        <div className="mt-5 flex justify-center">
          <AiActions prompt={prompt} responseFormat="text" onError={setError} onResponse={setExplanation} />
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {explanation && (
        <motion.section
          className="mt-8 rounded-2xl bg-muted/70 p-5 text-left sm:p-6"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={resultTransition}
        >
          <h2 className="font-semibold">{t("practice.explanationTitle")}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{explanation}</p>
        </motion.section>
      )}
    </motion.div>
  );
}
