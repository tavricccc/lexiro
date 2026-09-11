"use client";

import type {
  PracticeSessionSnapshot,
  PracticeTask,
  PracticeTrack,
  SenseId,
  WorkspaceQuestionDifficulty,
} from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import { useEffect } from "react";

import { buildQuestionGroups } from "@/components/practice/practice-content";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import {
  buildPracticeQueue,
  buildWrongContent,
  countTaskAvailability,
} from "@/components/practice/practice-queue";
import { ResultPanel } from "@/components/practice/result-panel";
import { PracticeSessionView } from "@/components/practice/practice-session-view";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { PracticePageSkeleton } from "@/components/ui/workspace-skeleton";
import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";
import {
  usePersistPracticeSession,
  usePracticePreferences,
  useRestorePracticeSession,
} from "@/components/practice/use-practice-persistence";
import { usePracticeSessionActions } from "@/components/practice/use-practice-session-actions";
import { DEFAULT_CARD_TASKS } from "@/constants";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { useUIStore } from "@/stores/ui-store";
import { senseToStudyWord } from "@/src/lib/library";

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

  const [tasks, setTasks] = useState<PracticeTask[]>([...DEFAULT_CARD_TASKS]);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<WorkspaceQuestionDifficulty>("all");
  const [leechOnly, setLeechOnly] = useState(false);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [entries, setEntries] = useState<PracticeEntry[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<SenseId[]>([]);
  const [answerChoices, setAnswerChoices] = useState<Array<number | null>>([]);
  const restoreAttempted = useRef(false);
  const sessionRestored = useRef(false);

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
    () => buildQuestionGroups(state.questions, state.words),
    [state.questions, state.words],
  );
  const allQuestionItems = useMemo(
    () => questionGroups.flat(),
    [questionGroups],
  );
  const setIds = useMemo(
    () => new Set(state.sets.map((entry) => entry.id)),
    [state.sets],
  );

  const poolInput = {
    allowedSenseIds,
    cards: progress.cards,
    difficulty,
    leechOnly,
    questionGroups,
    studyItems,
  };
  const counts = useMemo(
    () => countTaskAvailability(poolInput),
    [allowedSenseIds, difficulty, leechOnly, progress.cards, questionGroups, studyItems],
  );
  const queue = useMemo(
    () => buildPracticeQueue({ ...poolInput, amount, tasks }),
    [
      allowedSenseIds,
      amount,
      difficulty,
      leechOnly,
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

  useEffect(() => {
    setPracticeActive(started && !complete);
    return () => setPracticeActive(false);
  }, [complete, setPracticeActive, started]);

  const restoreSession = useCallback(
    (saved: PracticeSessionSnapshot, savedEntries: PracticeEntry[]) => {
      setTasks(saved.tasks);
      setSetId(saved.setId);
      setAmount(saved.amount);
      setIndex(saved.index);
      setCorrect(saved.correct);
      setWrong(saved.wrong);
      setSkipped(saved.skipped);
      setMarked(saved.marked);
      setSelected(saved.selected);
      setRevealed(saved.revealed);
      setDifficulty(saved.difficulty);
      setRetrying(saved.retrying);
      setQuestionFailedSenses(saved.failedSenseIds);
      setAnswerChoices(saved.answerChoices);
      setEntries(savedEntries);
      setStarted(true);
    },
    [],
  );

  useRestorePracticeSession({
    allQuestionItems,
    allStudyItems,
    enabled: libraryStatus === "ready" && learningLoaded,
    initialSet,
    memberships: state.memberships,
    restoreAttempted,
    sessionRestored,
    setIds,
    onRestore: restoreSession,
  });

  usePracticePreferences({
    initialSet,
    learningLoaded,
    started: started || sessionRestored.current,
    values: { amount, difficulty, leechOnly, setId, tasks },
    setAmount,
    setDifficulty,
    setLeechOnly,
    setSetId,
    setTasks,
  });
  usePersistPracticeSession({
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
    kind: current?.kind ?? "card",
    revealed,
    selected,
    busy: actions.actionBusy,
    onReveal: () => setRevealed(true),
    onRate: (rating) => void actions.rate(rating, true),
    onAnswer: (choice) => void actions.answer(choice),
    onNext: () => actions.next(true),
    optionCount:
      current?.kind === "question" ? current.item.options.length : 4,
  });

  if (libraryStatus !== "ready" || !learningLoaded) {
    return <PracticePageSkeleton />;
  }

  if (!started) {
    return (
      <PracticeSetup
        amount={amount}
        cardCount={counts.flashcard}
        counts={counts}
        difficulty={difficulty}
        hasWords={hasWords}
        leechOnly={leechOnly}
        onAmountChange={setAmount}
        onBegin={actions.begin}
        onDifficultyChange={setDifficulty}
        onLeechOnlyChange={setLeechOnly}
        onSetChange={setSetId}
        onTasksChange={setTasks}
        queueLength={queue.length}
        setId={setId}
        sets={state.sets}
        tasks={tasks}
        trackPreset={initialTrack}
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
      revealed={revealed}
      selected={selected}
      marked={marked.includes(index)}
      busy={actions.actionBusy}
      animateCard={actions.animateNextCard}
      onLeave={actions.leave}
      onReveal={() => setRevealed(true)}
      onRate={(rating) => void actions.rate(rating)}
      onToggleMark={() =>
        setMarked((values) =>
          values.includes(index)
            ? values.filter((value) => value !== index)
            : [...values, index],
        )
      }
      onSkip={() => void actions.skip()}
      onAnswer={(choice) => void actions.answer(choice)}
      onNext={() => actions.next()}
    />
  );
}
