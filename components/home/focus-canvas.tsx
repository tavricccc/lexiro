"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { StepActions } from "@/components/ui/step-actions";
import { LearningRows } from "./learning-row";
import { ContentTransition } from "@/components/motion/state-transition";
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
import { buildMeaningQuestionGroups } from "@/components/practice/meaning-questions";
import { senseToStudyWord } from "@/src/lib/library";

const GUIDE = [
  ["home.guideStepOne", "home.guideStepOneHint"],
  ["home.guideStepTwo", "home.guideStepTwoHint"],
  ["home.guideStepThree", "home.guideStepThreeHint"],
] as const;

export function FocusCanvas() {
  const [tab, setTab] = useState("today");
  const library = useLibraryStore((store) => store.state);
  const cards = useLearningStore((store) => store.progress.cards);
  const stats = useLearningStore((store) => store.stats);
  const reviewCount = useMemo(
    () => countReviewableSenses(library.words, cards),
    [cards, library.words],
  );
  const questionCount = useMemo(
    () =>
      countQuestionItems(library) +
      new Set(
        buildMeaningQuestionGroups(
          Object.values(library.words).flatMap((word) =>
            word.senses.map((sense) => senseToStudyWord(word, sense)),
          ),
        )
          .flat()
          .map((item) => item.wordKey),
      ).size,
    [library],
  );
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
    : questionCount > 0
      ? "/app/practice"
      : "/app/sets/new";
  const primaryLabel = !hasContent
    ? "home.createFirstSet"
    : questionCount > 0
      ? "home.startQuestions"
      : "library.newSet";

  return (
    <section className="study-home">
      <LiquidTabs
        ariaLabel={t("nav.study")}
        className="workspace-tabs"
        onValueChange={setTab}
        options={[
          { value: "today", label: t("home.tasksTab") },
          { value: "recent", label: t("home.recentTab") },
        ]}
        value={tab}
      />
      <ContentTransition identity={tab}>
        {tab === "recent" ? (
          <LearningRows />
        ) : (
          <>
            <div className="study-invitation" data-empty={!hasContent}>
              <div className="study-invitation-copy">
                <h2>
                  {t(
                    !hasContent
                      ? "home.appWelcomeTitle"
                      : goalMet
                        ? "home.finishedTitle"
                        : "home.appStudyTitle",
                  )}
                </h2>
                <p>
                  {t(
                    !hasContent
                      ? "home.appWelcomeHint"
                      : goalMet
                        ? "home.todayDone"
                        : "home.appStudyHint",
                  )}
                </p>
                {hasContent && (
                  <span className="study-available">
                    {t("home.available", { count: reviewCount })}
                  </span>
                )}
              </div>
              {!hasContent && (
                <div className="study-illustration" aria-hidden="true" />
              )}
            </div>

            {hasContent ? (
              <>
                <div className="study-checklist">
                  <StudyProgress
                    href="/app/practice"
                    label={t("home.wordsToday")}
                    value={wordsToday}
                    goal={stats.dailyWordGoal}
                    disabled={reviewCount === 0}
                    emptyHint={t("home.nothingDue")}
                  />
                  <StudyProgress
                    href="/app/practice"
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
            {hasContent && (
              <div className="desktop-recent hidden md:block">
                <LearningRows />
              </div>
            )}
          </>
        )}
      </ContentTransition>
      <StepActions aboveNavigation width="wide">
        <div className="workspace-actions">
          <Button asChild size="lg" variant="outline">
            <Link href={hasContent ? "/app/sets/new" : "/app/library"}>
              {hasContent ? <Icons.create /> : <Icons.library />}
              {t(hasContent ? "library.newSet" : "home.openLibrary")}
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href={primaryHref}>
              <Icons.start />
              {t(primaryLabel)}
            </Link>
          </Button>
        </div>
      </StepActions>
    </section>
  );
}
