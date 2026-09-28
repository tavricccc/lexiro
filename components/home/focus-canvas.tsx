"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  countQuestionItems,
  countReviewableSenses,
} from "@/src/lib/library-metrics";
import { localDateKey } from "@/src/lib/date";
import { StudyProgress } from "./study-progress";

const GUIDE = [
  ["home.guideStepOne", "home.guideStepOneHint"],
  ["home.guideStepTwo", "home.guideStepTwoHint"],
  ["home.guideStepThree", "home.guideStepThreeHint"],
] as const;

export function FocusCanvas() {
  const library = useLibraryStore((store) => store.state);
  const cards = useLearningStore((store) => store.progress.cards);
  const stats = useLearningStore((store) => store.stats);
  const reviewCount = useMemo(
    () => countReviewableSenses(library.words, cards),
    [cards, library.words],
  );
  const questionCount = useMemo(() => countQuestionItems(library), [library]);
  const hasContent = Object.keys(library.words).length > 0;
  const activity = stats.dailyHistory[localDateKey()];
  const wordsToday = activity ? activity.memoryAgain + activity.memoryGood : 0;
  const questionsToday =
    stats.lastStudyDate === localDateKey() ? stats.todayQuestionReviews : 0;
  const goalMet =
    wordsToday >= stats.dailyWordGoal &&
    questionsToday >= stats.dailyQuestionGoal;
  const primaryHref = !hasContent
    ? "/app/sets/new"
    : reviewCount > 0
      ? "/app/practice?track=fsrs"
      : questionCount > 0
        ? "/app/practice?track=questions"
        : "/app/sets/new";
  const primaryLabel = !hasContent
    ? "home.createFirstSet"
    : reviewCount > 0
      ? "home.startReview"
      : questionCount > 0
        ? "home.startQuestions"
        : "library.newSet";

  return (
    <section className="study-home">
      <div className="study-invitation">
        <div className="study-invitation-copy">
          <h2>
            {t(
              !hasContent
                ? "home.welcomeTitle"
                : goalMet
                  ? "home.finishedTitle"
                  : "home.greeting",
            )}
          </h2>
          <p>
            {t(
              !hasContent
                ? "home.welcomeHint"
                : goalMet
                  ? "home.todayDone"
                  : "home.studyHint",
            )}
          </p>
          <Link className="study-start" href={primaryHref}>
            {t(primaryLabel)}
            <Icons.next aria-hidden className="size-5" />
          </Link>
          {hasContent && (
            <span className="study-available">
              {t("home.available", { count: reviewCount })}
            </span>
          )}
        </div>
        <div className="study-illustration" aria-hidden="true" />
      </div>

      {hasContent ? (
        <>
          <div className="study-checklist">
            <StudyProgress
              href="/app/practice?track=fsrs"
              label={t("home.wordsToday")}
              value={wordsToday}
              goal={stats.dailyWordGoal}
              disabled={reviewCount === 0}
              emptyHint={t("home.nothingDue")}
            />
            <StudyProgress
              href="/app/practice?track=questions"
              label={t("home.questionsToday")}
              value={questionsToday}
              goal={stats.dailyQuestionGoal}
              disabled={questionCount === 0}
            />
          </div>
          <div className="study-tools">
            <Link href="/app/questions/generate">
              <Icons.generate aria-hidden className="size-4" />
              {t("home.generateQuestions")}
              <Icons.next aria-hidden className="size-4" />
            </Link>
            {primaryHref !== "/app/sets/new" && (
              <Link href="/app/sets/new">
                <Icons.create aria-hidden className="size-4" />
                {t("library.newSet")}
                <Icons.next aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        </>
      ) : (
        <ol className="study-guide">
          {GUIDE.map(([label, hint], index) => (
            <li key={label}>
              <span className="study-guide-step" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{t(label)}</h3>
                <p>{t(hint)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
