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

const GUIDE = [
  ["home.guideStepOne", "home.guideStepOneHint"],
  ["home.guideStepTwo", "home.guideStepTwoHint"],
  ["home.guideStepThree", "home.guideStepThreeHint"],
] as const;

/**
 * The one orchestrated entrance in the app. Every other surface stays still, so
 * the canvas reads as the start of the session rather than as another animated
 * card in a stack of them.
 *
 * It carries exactly one recommended action, and that action follows the
 * numbers rather than merely the presence of a library: sending someone to a
 * review that has nothing due is a dead end dressed up as a start button.
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
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[var(--radius-stage)] bg-surface-canvas px-6 py-8 sm:px-9 sm:py-10"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
          {t(hasContent ? "home.greeting" : "home.guideTitle")}
        </h1>

        {hasContent ? (
          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
            <Figure label={t("home.reviewLabel")} value={reviewCount} />
            <Figure label={t("home.questionLabel")} value={questionCount} />
          </dl>
        ) : (
          // A new library has nothing worth counting, so the canvas explains the
          // loop instead of showing two zeroes.
          <ol className="mt-7 grid gap-4">
            {GUIDE.map(([label, hint], index) => (
              <li className="flex gap-3.5" key={label}>
                <span
                  aria-hidden
                  className="mt-0.5 font-lexical text-sm tabular-nums text-brand-600"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{t(label)}</span>
                  <span className="mt-0.5 block max-w-[44ch] text-sm leading-6 text-muted-foreground">
                    {t(hint)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}

        {hasContent && (
          <p className="mt-6 max-w-[46ch] text-sm leading-6 text-muted-foreground">
            {t(
              reviewCount
                ? "home.recommendation"
                : questionCount
                  ? "home.questionRecommendation"
                  : "home.emptyRecommendation",
            )}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2.5">
          {!hasContent ? (
            <Action
              href="/sets/new"
              icon={Icons.create}
              label={t("home.createFirstSet")}
            />
          ) : reviewCount ? (
            <>
              <Action
                href="/practice?mode=review&start=1"
                icon={Icons.review}
                label={t("home.startReview")}
              />
              {questionCount ? (
                <Action
                  href="/practice?mode=questions&start=1"
                  icon={Icons.practice}
                  label={t("home.startQuestions")}
                  variant="secondary"
                />
              ) : (
                <Action
                  href="/questions/generate"
                  icon={Icons.generate}
                  label={t("home.generateQuestions")}
                  variant="secondary"
                />
              )}
            </>
          ) : questionCount ? (
            <>
              <Action
                href="/practice?mode=questions&start=1"
                icon={Icons.practice}
                label={t("home.startQuestions")}
              />
              <Action
                href="/library"
                icon={Icons.library}
                label={t("home.openLibrary")}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <Action
                href="/questions/generate"
                icon={Icons.generate}
                label={t("home.generateQuestions")}
              />
              <Action
                href="/library"
                icon={Icons.library}
                label={t("home.openLibrary")}
                variant="secondary"
              />
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function Action({
  href,
  icon: Icon,
  label,
  variant = "default",
}: {
  href: string;
  icon: typeof Icons.review;
  label: string;
  variant?: "default" | "secondary";
}) {
  return (
    <Button asChild size="lg" variant={variant}>
      <Link href={href}>
        <Icon />
        {label}
      </Link>
    </Button>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-lexical text-[2.5rem] font-medium leading-none tabular-nums">
        {value}
      </dd>
    </div>
  );
}
