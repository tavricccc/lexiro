"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

import { ListNavRow, ListSection } from "@/components/ui/list";
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
 * The ways into a session are a list, not a row of buttons. Two buttons beside
 * each other are a decision and its way out; these are two errands, and each
 * one has a number that decides whether you want it today — how much is due,
 * how many questions are waiting. A row has somewhere to put that number.
 */
export function FocusCanvas() {
  const library = useLibraryStore((store) => store.state);
  const cards = useLearningStore((store) => store.progress.cards);
  const reviewCount = useMemo(
    () => countReviewableSenses(library.words, cards),
    [cards, library.words],
  );
  const questionCount = useMemo(() => countQuestionItems(library), [library]);
  const senseCount = Object.keys(library.words).length;
  const hasContent = senseCount > 0;

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative overflow-hidden rounded-[var(--radius-stage)] bg-surface-canvas px-6 py-8 sm:px-9 sm:py-10">
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
          <h1 className="type-page max-w-xl">
            {t(hasContent ? "home.greeting" : "home.guideTitle")}
          </h1>

          {hasContent ? (
            <>
              <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
                <Figure label={t("home.reviewLabel")} value={reviewCount} />
                <Figure label={t("home.questionLabel")} value={questionCount} />
              </dl>
              <p className="mt-6 max-w-[46ch] type-lead">
                {t(
                  reviewCount
                    ? "home.recommendation"
                    : questionCount
                      ? "home.questionRecommendation"
                      : "home.emptyRecommendation",
                )}
              </p>
            </>
          ) : (
            // A new library has nothing worth counting, so the canvas explains
            // the loop instead of showing two zeroes.
            <ol className="mt-7 grid gap-4">
              {GUIDE.map(([label, hint], index) => (
                <li className="flex gap-3.5" key={label}>
                  <span
                    aria-hidden
                    className="mt-0.5 text-sm tabular-nums text-brand-600"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{t(label)}</span>
                    <span className="mt-0.5 block max-w-[44ch] type-lead">
                      {t(hint)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <ListSection className="mt-5" header={t("home.startHeader")}>
        {!hasContent ? (
          <ListNavRow
            href="/sets/new"
            icon={Icons.create}
            label={t("home.createFirstSet")}
          />
        ) : (
          <>
            <ListNavRow
              href="/practice?track=fsrs"
              icon={Icons.review}
              label={t("home.startReview")}
              value={
                reviewCount
                  ? t("home.dueCount", { count: reviewCount })
                  : t("home.nothingDue")
              }
            />
            {questionCount > 0 && (
              <ListNavRow
                href="/practice?track=questions"
                icon={Icons.practice}
                label={t("home.startQuestions")}
                value={t("home.questionCount", { count: questionCount })}
              />
            )}
            <ListNavRow
              href="/questions/generate"
              icon={Icons.generate}
              label={t("home.generateQuestions")}
              value={t("home.senseCount", { count: senseCount })}
            />
          </>
        )}
      </ListSection>
    </motion.section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[2.5rem] font-medium leading-none tabular-nums">
        {value}
      </dd>
    </div>
  );
}
