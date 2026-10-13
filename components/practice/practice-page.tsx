"use client";

import type { PracticeSessionSnapshot, PracticeTrack, SenseId } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import { useEffect } from "react";

import { usedBlankForOption } from "@/components/practice/practice-content";
import { usePracticePool } from "@/components/practice/use-practice-pool";
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
  type PracticeRestoreIssue,
} from "@/components/practice/use-practice-persistence";
import { usePracticeSessionActions } from "@/components/practice/use-practice-session-actions";
import { usePracticeSetupChoices } from "@/components/practice/use-practice-setup-choices";
import { clearPracticeDraft } from "@/src/lib/practice-storage";
import { PRACTICE_DRAFT_REMOTE_EVENT } from "@/constants";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { useUIStore } from "@/stores/ui-store";

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
  const setPracticeActive = useUIStore((store) => store.setPracticeActive);
  const setup = usePracticeSetupChoices(initialSet, initialTrack);
  const { amount, difficulty, oneSensePerWord, setId, tasks } =
    setup;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  // Picked but not yet confirmed; nothing is scored until the learner confirms.
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  // An earlier entry being looked back at; null keeps the open entry on screen.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
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
  const [restoreIssue, setRestoreIssue] = useState<PracticeRestoreIssue | null>(
    null,
  );
  const [restartError, setRestartError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<SenseId[]>(
    [],
  );
  const [answerChoices, setAnswerChoices] = useState<Array<number | null>>([]);
  const restoreAttempted = useRef(false);
  const [restoreCheck, setRestoreCheck] = useState(0);
  const {
    allowedSenseIds,
    studyItems,
    allStudyItems,
    questionGroups,
    allQuestionItems,
  } = usePracticePool(state, setId);
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

  const poolInput = {
    allowedSenseIds,
    difficulty,
    questionGroups,
    studyItems,
  };
  const counts = useMemo(
    () => countTaskAvailability(poolInput),
    [
      allowedSenseIds,
      difficulty,
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
      oneSensePerWord,
      questionGroups,
      studyItems,
      tasks,
    ],
  );

  const activeEntries = entries ?? [];
  const total = activeEntries.length;
  const complete = started && index >= total;
  const current = activeEntries[index];
  const reviewing = viewIndex !== null && viewIndex < index;
  const viewPosition = reviewing ? viewIndex : index;
  const viewed = activeEntries[viewPosition];
  const viewedChoice = reviewing
    ? (answerChoices[viewPosition] ?? null)
    : selected;
  const hasWords = Object.keys(state.words).length > 0;
  const completedSteps =
    current?.kind === "question" && selected !== null ? index + 1 : index;
  const progressRatio = total ? Math.min(1, completedSteps / total) : 0;
  const wrongContent = buildWrongContent(wrong, activeEntries, answerChoices);
  const answeredBlanks: Record<number, AnsweredBlank> = {};
  if (
    viewed?.kind === "question" &&
    viewed.item.question?.kind === "reading"
  ) {
    const questionId = viewed.item.question.id;
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
      setPendingChoice(null);
      setViewIndex(null);
      setRevealed(saved.revealed);
      setRetrying(saved.retrying);
      setQuestionFailedSenses(saved.failedSenseIds);
      setAnswerChoices(saved.answerChoices);
      setEntries(savedEntries);
      setStarted(true);
    },
    [setup],
  );

  // Another device's session can land while this page waits on the setup or
  // resume screen; offer that one instead. A running session keeps going and
  // its next answer makes it the newer one again.
  useEffect(() => {
    if (started) return;
    const recheck = () => {
      restoreAttempted.current = false;
      setPendingSession(null);
      setRestoreIssue(null);
      setRestoreCheck((value) => value + 1);
    };
    window.addEventListener(PRACTICE_DRAFT_REMOTE_EVENT, recheck);
    return () => window.removeEventListener(PRACTICE_DRAFT_REMOTE_EVENT, recheck);
  }, [started]);

  useRestorePracticeSession({
    allQuestionItems,
    allStudyItems,
    checkRevision: restoreCheck,
    enabled: libraryStatus === "ready",
    initialSet,
    library: state,
    retiredEntryIds,
    restoreAttempted,
    onOffer: useCallback((snapshot, entries) => {
      setPendingSession({ snapshot, entries });
      setResumeChecked(true);
    }, []),
    onChecked: useCallback(() => setResumeChecked(true), []),
    onUnavailable: useCallback((issue) => setRestoreIssue(issue), []),
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
    queue,
    questionFailedSenses,
    selected,
    setters: {
      setAnswerChoices,
      setCorrect,
      setEntries,
      setIndex,
      setMarked,
      setPendingChoice,
      setQuestionFailedSenses,
      setRetrying,
      setRevealed,
      setSelected,
      setSkipped,
      setStarted,
      setViewIndex,
      setWrong,
    },
  });

  const selectChoice = (choice: number) => {
    if (
      reviewing ||
      selected !== null ||
      !current ||
      usedBlankForOption(current.item, choice, answeredBlanks) !== undefined
    )
      return;
    setPendingChoice(choice);
  };
  const confirmChoice = () => {
    if (pendingChoice !== null) actions.answer(pendingChoice);
  };
  const goPrevious = () => {
    if (viewPosition > 0) setViewIndex(viewPosition - 1);
  };
  const goForward = () => {
    const nextPosition = viewPosition + 1;
    setViewIndex(nextPosition < index ? nextPosition : null);
  };

  usePracticeKeyboard({
    enabled: started && !complete && Boolean(current),
    selected,
    pendingChoice,
    reviewing,
    canGoBack: viewPosition > 0,
    onSelect: selectChoice,
    onConfirm: confirmChoice,
    onNext: () => actions.next(true),
    onPrevious: goPrevious,
    onForward: goForward,
    optionCount: viewed?.kind === "question" ? viewed.item.options.length : 4,
  });

  if (libraryStatus !== "ready") {
    return <PracticePageSkeleton />;
  }
  if (!resumeChecked) return <PracticePageSkeleton />;
  if (pendingSession || restoreIssue) {
    const issueDescription = {
      unreadable:
        "上次的練習草稿無法讀取，原始資料仍保留。選擇重新開始才會清除原進度。",
      source:
        "找不到上次練習的部分來源，原草稿仍保留。選擇重新開始才會清除原進度。",
      storage:
        "暫時無法讀取或保存上次練習。請確認瀏覽器儲存空間後重新載入；重新開始會清除已有草稿。",
    };
    return (
      <>
        <ResumeChoice
          back={
            <BackControl
              href={initialSet ? `/app/sets/${initialSet}` : "/app"}
            />
          }
          description={
            restoreIssue
              ? issueDescription[restoreIssue]
              : t("draft.practiceDescription")
          }
          invalid={Boolean(restoreIssue)}
          onResume={() => {
            if (!pendingSession) return;
            restoreSession(pendingSession.snapshot, pendingSession.entries);
            setPendingSession(null);
          }}
          onRestart={() => {
            try {
              clearPracticeDraft();
              setup.restart();
              setPendingSession(null);
              setRestoreIssue(null);
              setRestartError("");
            } catch {
              setRestartError(
                "無法清除舊進度。請確認瀏覽器儲存空間後再試一次。",
              );
            }
          }}
        />
        {restartError && (
          <p className="mx-auto max-w-xl text-sm text-destructive" role="alert">
            {restartError}
          </p>
        )}
      </>
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
        oneSensePerWord={oneSensePerWord}
        onAmountChange={setup.changeAmount}
        onBegin={() => {
          setup.clear();
          actions.begin();
        }}
        onDifficultyChange={setup.changeDifficulty}
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

  if (!current || !viewed) return <PracticePageSkeleton />;

  return (
    <PracticeSessionView
      entry={viewed}
      index={viewPosition}
      total={total}
      progressRatio={progressRatio}
      persistence={sessionPersistence}
      selected={viewedChoice}
      pendingChoice={pendingChoice}
      answeredBlanks={answeredBlanks}
      marked={marked.includes(viewPosition)}
      reviewing={reviewing}
      canGoBack={viewPosition > 0}
      animateCard={actions.animateNextCard}
      backHref={initialSet ? `/app/sets/${initialSet}` : "/app"}
      onToggleMark={() =>
        setMarked((values) =>
          values.includes(viewPosition)
            ? values.filter((value) => value !== viewPosition)
            : [...values, viewPosition],
        )
      }
      onSkip={actions.skip}
      onSelect={selectChoice}
      onConfirm={confirmChoice}
      onNext={() => actions.next()}
      onPrevious={goPrevious}
      onForward={goForward}
    />
  );
}
