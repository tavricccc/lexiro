"use client";

import type { PracticeSessionSnapshot, PracticeTrack, SenseId } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import { useEffect } from "react";

import {
  buildQuestionGroups,
  usedBlankForOption,
} from "@/components/practice/practice-content";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import {
  buildPracticeQueue,
  buildWrongContent,
  countQuestionAvailability,
  countTaskAvailability,
} from "@/components/practice/practice-queue";
import { ResultPanel } from "@/components/practice/result-panel";
import { PracticeSessionView } from "@/components/practice/practice-session-view";
import type { AnsweredBlank } from "@/components/practice/passage-view";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { BackControl } from "@/components/ui/back-control";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { PracticePageSkeleton } from "@/components/ui/workspace-skeleton";
import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";
import {
  usePersistPracticeSession,
  useRestorePracticeSession,
  buildPracticeSnapshot,
} from "@/components/practice/use-practice-persistence";
import { usePracticeSessionActions } from "@/components/practice/use-practice-session-actions";
import { usePracticeSetupChoices } from "@/components/practice/use-practice-setup-choices";
import { practiceStorageKey } from "@/src/lib/practice-storage";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { useUIStore } from "@/stores/ui-store";
import { senseToStudyWord } from "@/src/lib/library";
import { buildMeaningQuestionGroups } from "./meaning-questions";
import { isLeech } from "@/src/lib/fsrs";

/**
 * The session is one queue of entries built from the tasks the setup screen
 * chose. Nothing here asks "which mode is this" — the entry under the cursor
 * answers that, which is what lets one session hold more than one kind of step.
 */
export function PracticePage({
  initialSet = "",
  initialTrack,
}: {
  initialSet?: string;
  initialTrack?: PracticeTrack;
}) {
  const state = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const progress = useLearningStore((store) => store.progress);
  const learningLoaded = useLearningStore((store) => store.loaded);
  const setPracticeActive = useUIStore((store) => store.setPracticeActive);
  const setup = usePracticeSetupChoices(initialSet, initialTrack);
  const { amount, difficulty, leechOnly, oneSensePerWord, setId, tasks } =
    setup;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [entries, setEntries] = useState<PracticeEntry[] | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    snapshot: PracticeSessionSnapshot;
    entries: PracticeEntry[];
  } | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<SenseId[]>(
    [],
  );
  const [answerChoices, setAnswerChoices] = useState<Array<number | null>>([]);
  const restoreAttempted = useRef(false);
  const allowedSenseIds = useMemo(
    () =>
      new Set(
        (setId
          ? (state.memberships[setId] ?? [])
          : Object.values(state.memberships).flat()
        ).flatMap((entry) => entry.senseIds),
      ),
    [setId, state.memberships],
  );
  const studyItems = useMemo(
    () =>
      Object.values(state.words).flatMap((word) =>
        word.senses
          .filter((sense) => allowedSenseIds.has(sense.id))
          .map((sense) => senseToStudyWord(word, sense)),
      ),
    [allowedSenseIds, state.words],
  );
  const allStudyItems = useMemo(
    () =>
      Object.values(state.words).flatMap((word) =>
        word.senses.map((sense) => senseToStudyWord(word, sense)),
      ),
    [state.words],
  );
  const questionGroups = useMemo(
    () => [
      ...buildMeaningQuestionGroups(allStudyItems),
      ...buildQuestionGroups(state.questions, state.words),
    ],
    [allStudyItems, state.questions, state.words],
  );
  const allQuestionItems = useMemo(
    () => questionGroups.flat(),
    [questionGroups],
  );
  const retiredEntryIds = useMemo(
    () =>
      new Set(
        state.questions.flatMap((question) =>
          question.kind === "multipleChoice" &&
          question.questionStyle === "grammar"
            ? [`question:${question.id}`]
            : [],
        ),
      ),
    [state.questions],
  );
  const setIds = useMemo(
    () => new Set(state.sets.map((entry) => entry.id)),
    [state.sets],
  );

  const poolInput = {
    allowedSenseIds: leechOnly
      ? new Set(
          [...allowedSenseIds].filter((id) =>
            isLeech(progress.cards[id] ?? null),
          ),
        )
      : allowedSenseIds,
    cards: progress.cards,
    difficulty,
    leechOnly,
    questionGroups,
    studyItems,
  };
  const counts = useMemo(
    () => countTaskAvailability(poolInput),
    [
      allowedSenseIds,
      difficulty,
      leechOnly,
      progress.cards,
      questionGroups,
      studyItems,
    ],
  );
  const hasQuestionContent = questionGroups.some(
    (group) => group[0]?.type !== "meaning" && group.length > 0,
  );
  const availableQuestionCount = useMemo(
    () =>
      countQuestionAvailability({
        ...poolInput,
        tasks,
        oneSensePerWord,
      }),
    [
      allowedSenseIds,
      difficulty,
      leechOnly,
      progress.cards,
      studyItems,
      oneSensePerWord,
      questionGroups,
      tasks,
    ],
  );
  const queue = useMemo(
    () => buildPracticeQueue({ ...poolInput, amount, oneSensePerWord, tasks }),
    [
      allowedSenseIds,
      amount,
      difficulty,
      leechOnly,
      oneSensePerWord,
      progress.cards,
      questionGroups,
      studyItems,
      tasks,
    ],
  );

  const activeEntries = entries ?? [];
  const total = activeEntries.length;
  const complete = started && index >= total;
  const current = activeEntries[index];
  const hasWords = Object.keys(state.words).length > 0;
  const completedSteps =
    current?.kind === "question" && selected !== null ? index + 1 : index;
  const progressRatio = total ? Math.min(1, completedSteps / total) : 0;
  const wrongContent = buildWrongContent(wrong, activeEntries, answerChoices);
  const answeredBlanks: Record<number, AnsweredBlank> = {};
  if (
    current?.kind === "question" &&
    current.item.question?.kind === "reading"
  ) {
    const questionId = current.item.question.id;
    activeEntries.forEach((entry, position) => {
      if (
        entry.kind === "question" &&
        entry.item.blank &&
        entry.item.question?.id === questionId &&
        answerChoices[position] !== undefined &&
        answerChoices[position] !== null
      ) {
        answeredBlanks[entry.item.blank] = {
          answer: entry.item.options[entry.item.answerIndex],
        };
      }
    });
  }

  useEffect(() => {
    setPracticeActive(started && !complete);
    return () => setPracticeActive(false);
  }, [complete, setPracticeActive, started]);

  const restoreSession = useCallback(
    (saved: PracticeSessionSnapshot, savedEntries: PracticeEntry[]) => {
      setup.restoreSessionChoices(saved);
      setIndex(saved.index);
      setCorrect(saved.correct);
      setWrong(saved.wrong);
      setSkipped(saved.skipped);
      setMarked(saved.marked);
      setSelected(saved.selected);
      setRevealed(saved.revealed);
      setRetrying(saved.retrying);
      setQuestionFailedSenses(saved.failedSenseIds);
      setAnswerChoices(saved.answerChoices);
      setEntries(savedEntries);
      setStarted(true);
    },
    [setup],
  );

  useRestorePracticeSession({
    allQuestionItems,
    allStudyItems,
    enabled: libraryStatus === "ready" && learningLoaded,
    initialSet,
    memberships: state.memberships,
    retiredEntryIds,
    restoreAttempted,
    setIds,
    onOffer: useCallback((snapshot, entries) => {
      setPendingSession({ snapshot, entries });
      setResumeChecked(true);
    }, []),
    onChecked: useCallback(() => setResumeChecked(true), []),
  });

  const sessionPersistence = usePersistPracticeSession({
    amount,
    answerChoices,
    complete,
    correct,
    difficulty,
    entries: activeEntries,
    failedSenseIds: questionFailedSenses,
    index,
    marked,
    retrying,
    revealed,
    selected,
    setId,
    skipped,
    started,
    tasks,
    wrong,
  });

  const actions = usePracticeSessionActions({
    activeEntries,
    index,
    progressCards: progress.cards,
    queue,
    questionFailedSenses,
    retrying,
    selected,
    setters: {
      setAnswerChoices,
      setCorrect,
      setEntries,
      setIndex,
      setMarked,
      setQuestionFailedSenses,
      setRetrying,
      setRevealed,
      setSelected,
      setSkipped,
      setStarted,
      setWrong,
    },
  });

  usePracticeKeyboard({
    enabled: started && !complete && Boolean(current),
    selected,
    busy: actions.actionBusy,
    onAnswer: (choice) => {
      if (
        current &&
        usedBlankForOption(current.item, choice, answeredBlanks) !== undefined
      )
        return;
      void actions.answer(choice);
    },
    onNext: () => actions.next(true),
    optionCount: current?.kind === "question" ? current.item.options.length : 4,
  });

  if (libraryStatus !== "ready" || !learningLoaded) {
    return <PracticePageSkeleton />;
  }
  if (!resumeChecked) return <PracticePageSkeleton />;
  if (pendingSession) {
    return (
      <ResumeChoice
        back={
          <BackControl href={initialSet ? `/app/sets/${initialSet}` : "/app"} />
        }
        description={t("draft.practiceDescription")}
        onResume={() => {
          restoreSession(pendingSession.snapshot, pendingSession.entries);
          setPendingSession(null);
        }}
        onRestart={() => {
          localStorage.removeItem(practiceStorageKey());
          setup.restart();
          setPendingSession(null);
        }}
      />
    );
  }
  if (!started && setup.saved.status === "checking")
    return <PracticePageSkeleton />;
  if (
    !started &&
    (setup.saved.status === "offer" || setup.saved.status === "invalid")
  ) {
    return (
      <ResumeChoice
        back={
          <BackControl href={initialSet ? `/app/sets/${initialSet}` : "/app"} />
        }
        description={t(
          setup.saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.practiceDescription",
        )}
        invalid={setup.saved.status === "invalid"}
        onResume={setup.resume}
        onRestart={setup.restart}
      />
    );
  }

  if (!started) {
    return (
      <PracticeSetup
        amount={amount}
        availableQuestionCount={availableQuestionCount}
        backHref={initialSet ? `/app/sets/${initialSet}` : "/app"}
        counts={counts}
        difficulty={difficulty}
        hasWords={hasWords}
        hasQuestionContent={hasQuestionContent}
        leechOnly={leechOnly}
        oneSensePerWord={oneSensePerWord}
        onAmountChange={setup.changeAmount}
        onBegin={() => {
          setup.clear();
          actions.begin();
        }}
        onDifficultyChange={setup.changeDifficulty}
        onLeechOnlyChange={setup.changeLeechOnly}
        onOneSenseChange={setup.changeOneSense}
        onSetChange={setup.changeSet}
        onTasksChange={setup.changeTasks}
        queueLength={queue.length}
        setId={setId}
        sets={state.sets}
        tasks={tasks}
        draftPersistence={setup.saved.persistence}
      />
    );
  }

  if (complete) {
    return (
      <ResultPanel
        correct={correct}
        total={total}
        skipped={skipped.length}
        marked={marked.length}
        wrongContent={wrongContent}
        mode="questions"
        onRetry={() => actions.retry(wrong)}
        onRetryMarked={marked.length ? () => actions.retry(marked) : undefined}
      />
    );
  }

  if (!current) return <PracticePageSkeleton />;

  return (
    <PracticeSessionView
      entry={current}
      index={index}
      total={total}
      progressRatio={progressRatio}
      persistence={sessionPersistence}
      selected={selected}
      pendingChoice={actions.pendingChoice}
      recordFailed={actions.recordFailed}
      answeredBlanks={answeredBlanks}
      marked={marked.includes(index)}
      busy={actions.actionBusy}
      animateCard={actions.animateNextCard}
      onLeave={() => {
        if (actions.actionBusy) return;
        setPendingSession({
          entries: activeEntries,
          snapshot: buildPracticeSnapshot({
            entries: activeEntries,
            answerChoices,
            tasks,
            setId,
            amount,
            index,
            correct,
            wrong,
            skipped,
            marked,
            selected,
            revealed,
            difficulty,
            failedSenseIds: questionFailedSenses,
            retrying,
          }),
        });
        actions.leave();
      }}
      onToggleMark={() =>
        setMarked((values) =>
          values.includes(index)
            ? values.filter((value) => value !== index)
            : [...values, index],
        )
      }
      onSkip={() => void actions.skip()}
      onAnswer={(choice) => {
        if (
          usedBlankForOption(current.item, choice, answeredBlanks) !== undefined
        )
          return;
        void actions.answer(choice);
      }}
      onNext={() => actions.next()}
    />
  );
}
