"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  countQuestionItems,
  countReviewableSenses,
} from "@/src/lib/library-metrics";

/**
 * The one orchestrated entrance in the app. Every other surface stays still, so
 * the canvas reads as the start of the session rather than as another animated
 * card in a stack of them.
 */
export function FocusCanvas() {
  const library = useLibraryStore((store) => store.state);
  const cards = useLearningStore((store) => store.progress.cards);
  const reviewCount = useMemo(
    () => countReviewableSenses(library.words, cards),
    [cards, library.words],
  );
  const questionCount = useMemo(() => countQuestionItems(library), [library]);
  const hasContent = Object.keys(library.words).length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[var(--radius-stage)] bg-surface-canvas px-6 py-8 sm:px-9 sm:py-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 right-0 hidden aspect-[4/3] w-[26%] max-w-[17rem] bg-brand-600 opacity-[0.18] lg:block"
        style={{
          maskImage: "url(/illustrations/open-doodles-reading.svg)",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: "url(/illustrations/open-doodles-reading.svg)",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      />

      <div className="relative z-10 max-w-2xl">
        <h1 className="max-w-xl text-balance font-lexical text-[clamp(1.75rem,2.6vw,2.375rem)] font-medium leading-[1.15] tracking-[-0.01em]">
          {t("home.greeting")}
        </h1>

        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("home.reviewLabel")}
            </dt>
            <dd className="mt-1 font-lexical text-[2.5rem] font-medium leading-none tabular-nums">
              {reviewCount}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("home.questionLabel")}
            </dt>
            <dd className="mt-1 font-lexical text-[2.5rem] font-medium leading-none tabular-nums">
              {questionCount}
            </dd>
          </div>
        </dl>

        <p className="mt-6 max-w-[46ch] text-sm leading-6 text-muted-foreground">
          {t(
            reviewCount
              ? "home.recommendation"
              : questionCount
                ? "home.questionRecommendation"
                : "home.emptyRecommendation",
          )}
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <Link href={hasContent ? "/practice?mode=review&start=1" : "/sets/new"}>
              {hasContent ? <Icons.review /> : <Icons.create />}
              {t(hasContent ? "home.startReview" : "home.createFirstSet")}
            </Link>
          </Button>
          {hasContent && (
            <Button asChild size="lg" variant="secondary">
              <Link
                href={
                  questionCount
                    ? "/practice?mode=questions&start=1"
                    : "/questions/generate"
                }
              >
                {questionCount ? <Icons.practice /> : <Icons.generate />}
                {t(
                  questionCount ? "home.startQuestions" : "home.generateQuestions",
                )}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
