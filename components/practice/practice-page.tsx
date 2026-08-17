"use client";

import type { ReviewRating, StudyWord, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildQuestionGroups,
  buildWrongContent,
  type QuestionItem,
  selectQuestionItems,
} from "@/components/practice/practice-content";
import { ResultPanel } from "@/components/practice/result-panel";
import { PracticeSessionView } from "@/components/practice/practice-session-view";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";
import { PRACTICE_PREFERENCES_STORAGE_KEY, PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isSameLocalDay } from "@/src/lib/date";
import { isDue } from "@/src/lib/fsrs";
import { senseToStudyWord } from "@/src/lib/library";
import { canRestorePracticeSession, parsePracticeSession } from "@/src/lib/practice-session";

type Mode = WorkspacePracticeMode;
type QuestionType = WorkspaceQuestionType;
type Difficulty = WorkspaceQuestionDifficulty;

export function PracticePage({ initialMode = "review", initialSet = "" }: { initialMode?: Mode; initialSet?: string }) {
  const state = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const progress = useLearningStore((store) => store.progress);
  const learningLoaded = useLearningStore((store) => store.loaded);
  const rateSense = useLearningStore((store) => store.rateSense);
  const scheduleSenseFromQuestion = useLearningStore((store) => store.scheduleSenseFromQuestion);
  const recordQuestion = useLearningStore((store) => store.recordQuestion);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [questionType, setQuestionType] = useState<QuestionType>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[] | null>(null);
  const [sessionReviews, setSessionReviews] = useState<StudyWord[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [animateNextCard, setAnimateNextCard] = useState(true);
  const restoreAttempted = useRef(false);
  const sessionRestored = useRef(false);
  const actionPending = useRef(false);

  const allowedSenseIds = useMemo(
    () => new Set((setId ? state.memberships[setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds)),
    [setId, state.memberships],
  );
  const studyItems = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.filter((sense) => allowedSenseIds.has(sense.id)).map((sense) => senseToStudyWord(word, sense))),
    [allowedSenseIds, state.words],
  );
  const allStudyItems = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.map((sense) => senseToStudyWord(word, sense))),
    [state.words],
  );
  const reviewItems = useMemo(() => {
    const due = studyItems
      .filter((item) => progress.cards[item.id] && isDue(progress.cards[item.id]))
      .sort((a, b) => new Date(progress.cards[a.id].due).getTime() - new Date(progress.cards[b.id].due).getTime());
    const fresh = studyItems.filter((item) => !progress.cards[item.id]);
    const freshLimit = due.length ? Math.ceil(amount / 3) : amount;
    return [...due.slice(0, amount - Math.min(freshLimit, fresh.length)), ...fresh.slice(0, freshLimit)].slice(0, amount);
  }, [amount, progress.cards, studyItems]);
  const allQuestionGroups = useMemo(() => buildQuestionGroups(state.questions, state.words), [state.questions, state.words]);
  const allQuestionItems = useMemo(() => allQuestionGroups.flat(), [allQuestionGroups]);
  const questionItems = useMemo(
    () => selectQuestionItems(allQuestionGroups, allowedSenseIds, amount, questionType, difficulty),
    [allQuestionGroups, allowedSenseIds, amount, difficulty, questionType],
  );

  const activeReviews = started ? sessionReviews ?? [] : reviewItems;
  const activeQuestions = started ? sessionQuestions ?? [] : questionItems;
  const total = mode === "review" ? activeReviews.length : activeQuestions.length;
  const complete = started && index >= total;
  const hasWords = Object.keys(state.words).length > 0;
  const completedSteps = mode === "questions" && selected !== null ? index + 1 : index;
  const progressRatio = total ? Math.min(1, completedSteps / total) : 0;
  const wrongContent = buildWrongContent(mode, wrong, activeReviews, activeQuestions);

  useEffect(() => {
    if (restoreAttempted.current || libraryStatus !== "ready" || !learningLoaded) return;
    restoreAttempted.current = true;
    const raw = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
    const saved = parsePracticeSession(raw);
    if (!saved) {
      if (raw) localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    if (!canRestorePracticeSession(saved, initialMode, initialSet)) return;
    const allowed = new Set((saved.setId ? state.memberships[saved.setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds));
    const sourceItems = saved.mode === "review" ? allStudyItems : allQuestionItems;
    const byId = new Map(sourceItems.map((item) => [item.id, item]));
    const items = saved.itemIds.map((id) => byId.get(id));
    const invalidItems = items.some((item) => !item || !allowed.has(saved.mode === "review" ? (item as StudyWord).id : (item as QuestionItem).senseId));
    if ((saved.setId && !state.sets.some((entry) => entry.id === saved.setId)) || invalidItems) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    sessionRestored.current = true;
    setMode(saved.mode);
    setSetId(saved.setId);
    setAmount(saved.amount);
    setIndex(saved.index);
    setCorrect(saved.correct);
    setWrong(saved.wrong);
    setSkipped(saved.skipped);
    setMarked(saved.marked);
    setSelected(saved.selected);
    setRevealed(saved.revealed);
    setQuestionType(saved.questionType);
    setDifficulty(saved.difficulty);
    setRetrying(saved.retrying);
    setQuestionFailedSenses(saved.failedSenseIds);
    if (saved.mode === "review") setSessionReviews(items as StudyWord[]);
    else setSessionQuestions(items as QuestionItem[]);
    setStarted(true);
  }, [allQuestionItems, allStudyItems, initialMode, initialSet, learningLoaded, libraryStatus, state.memberships, state.sets]);

  useEffect(() => {
    if (!learningLoaded || started || sessionRestored.current) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PRACTICE_PREFERENCES_STORAGE_KEY) ?? "{}") as {
        setId?: string;
        amount?: number;
        questionType?: QuestionType;
        difficulty?: Difficulty;
      };
      if (!initialSet && saved.setId) setSetId(saved.setId);
      if (saved.amount) setAmount(saved.amount);
      if (saved.questionType) setQuestionType(saved.questionType);
      if (saved.difficulty) setDifficulty(saved.difficulty);
    } catch {
      // Defaults remain usable when preferences were corrupted.
    }
  }, [initialSet, learningLoaded, started]);

  useEffect(() => {
    if (started) return;
    localStorage.setItem(PRACTICE_PREFERENCES_STORAGE_KEY, JSON.stringify({ setId, amount, questionType, difficulty }));
  }, [amount, difficulty, questionType, setId, started]);

  useEffect(() => {
    if (!started) return;
    if (complete) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    const itemIds = (mode === "review" ? activeReviews : activeQuestions).map((item) => item.id);
    if (!itemIds.length) return;
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      mode,
      setId,
      amount,
      index,
      correct,
      wrong,
      skipped,
      marked,
      selected,
      revealed,
      questionType,
      difficulty,
      itemIds,
      failedSenseIds: questionFailedSenses,
      retrying,
    }));
  }, [activeQuestions, activeReviews, amount, complete, correct, difficulty, index, marked, mode, questionFailedSenses, questionType, retrying, revealed, selected, setId, skipped, started, wrong]);

  const resetAttempt = () => {
    actionPending.current = false;
    setActionBusy(false);
    setIndex(0);
    setCorrect(0);
    setWrong([]);
    setSkipped([]);
    setMarked([]);
    setSelected(null);
    setRevealed(false);
  };
  const advance = (fromKeyboard = false) => {
    setAnimateNextCard(!fromKeyboard);
    setIndex((value) => value + 1);
    setRevealed(false);
    setSelected(null);
  };
  const next = (fromKeyboard = false) => {
    if (actionPending.current) return;
    advance(fromKeyboard);
  };
  const rate = async (rating: ReviewRating, fromKeyboard = false) => {
    const item = activeReviews[index];
    if (!item || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      await rateSense(item.id, rating);
      if (rating === "good") setCorrect((value) => value + 1);
      else setWrong((value) => [...value, index]);
      advance(fromKeyboard);
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };
  const answer = async (choice: number) => {
    if (selected !== null || actionPending.current) return;
    const item = activeQuestions[index];
    if (!item) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      const isCorrect = choice === item.answerIndex;
      setSelected(choice);
      setRevealed(true);
      if (isCorrect) setCorrect((value) => value + 1);
      else setWrong((value) => [...value, index]);
      const card = progress.cards[item.senseId];
      const reviewedToday = card?.lastReview ? isSameLocalDay(new Date(card.lastReview), new Date()) : false;
      if (!isCorrect && !questionFailedSenses.includes(item.senseId)) {
        setQuestionFailedSenses((values) => [...values, item.senseId]);
        await scheduleSenseFromQuestion(item.senseId, "again");
      } else if (isCorrect && !reviewedToday) {
        await scheduleSenseFromQuestion(item.senseId, "good");
      }
      await recordQuestion(item.senseId, item.type, item.difficulty, isCorrect, retrying);
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };
  const skip = async () => {
    const item = activeQuestions[index];
    if (!item || selected !== null || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      setSkipped((values) => [...values, index]);
      setWrong((values) => [...values, index]);
      await recordQuestion(item.senseId, item.type, item.difficulty, false, retrying);
      advance();
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };
  const begin = () => {
    if (mode === "review") {
      setSessionReviews(reviewItems);
      setSessionQuestions(null);
    } else {
      setSessionQuestions(questionItems);
      setSessionReviews(null);
    }
    setRetrying(false);
    setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
    setStarted(true);
  };
  const leave = () => {
    localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
    setStarted(false);
    setSessionReviews(null);
    setSessionQuestions(null);
    setRetrying(false);
    setQuestionFailedSenses([]);
    resetAttempt();
  };
  const retry = (indices: number[]) => {
    if (mode === "review") setSessionReviews(indices.map((value) => activeReviews[value]).filter(Boolean));
    else setSessionQuestions(indices.map((value) => activeQuestions[value]).filter(Boolean));
    setRetrying(true);
    setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
  };

  usePracticeKeyboard({
    enabled: started && !complete,
    mode,
    revealed,
    selected,
    busy: actionBusy,
    onReveal: () => setRevealed(true),
    onRate: (rating) => void rate(rating, true),
    onAnswer: (choice) => void answer(choice),
    onNext: () => next(true),
  });

  if (libraryStatus !== "ready" || !learningLoaded) {
    return <div className="py-20 text-center text-sm text-muted-foreground">{t("library.loading")}</div>;
  }

  if (!started) {
    return (
      <PracticeSetup
        mode={mode}
        setId={setId}
        amount={amount}
        questionType={questionType}
        difficulty={difficulty}
        sets={state.sets}
        availableCount={mode === "review" ? reviewItems.length : questionItems.length}
        hasWords={hasWords}
        onModeChange={setMode}
        onSetChange={setSetId}
        onAmountChange={setAmount}
        onQuestionTypeChange={setQuestionType}
        onDifficultyChange={setDifficulty}
        onBegin={begin}
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
        onRetry={() => retry(wrong)}
        onRetryMarked={marked.length ? () => retry(marked) : undefined}
        onContinueQuestions={mode === "review" && questionItems.length ? () => {
          setMode("questions");
          setSessionReviews(null);
          setSessionQuestions(questionItems);
          setRetrying(false);
          setQuestionFailedSenses([]);
          setAnimateNextCard(true);
          resetAttempt();
        } : undefined}
      />
    );
  }

  return (
    <PracticeSessionView
      mode={mode}
      index={index}
      total={total}
      progressRatio={progressRatio}
      review={mode === "review" ? activeReviews[index] : undefined}
      question={mode === "questions" ? activeQuestions[index] : undefined}
      revealed={revealed}
      selected={selected}
      marked={marked.includes(index)}
      busy={actionBusy}
      animateCard={animateNextCard}
      onLeave={leave}
      onReveal={() => setRevealed(true)}
      onRate={(rating) => void rate(rating)}
      onToggleMark={() => setMarked((values) => values.includes(index) ? values.filter((value) => value !== index) : [...values, index])}
      onSkip={() => void skip()}
      onAnswer={(choice) => void answer(choice)}
      onNext={() => next()}
    />
  );
}
