"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { PracticeEntry } from "@/components/practice/practice-queue";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { isSameLocalDay } from "@/src/lib/date";
import { isCorrectChoice } from "./meaning-questions";
import type { CardProgress, ReviewRating, SenseId } from "@/types";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface SessionSetters {
  setAnswerChoices: Setter<Array<number | null>>;
  setCorrect: Setter<number>;
  setEntries: Setter<PracticeEntry[] | null>;
  setIndex: Setter<number>;
  setMarked: Setter<number[]>;
  setQuestionFailedSenses: Setter<SenseId[]>;
  setRetrying: Setter<boolean>;
  setRevealed: Setter<boolean>;
  setSelected: Setter<number | null>;
  setSkipped: Setter<number[]>;
  setStarted: Setter<boolean>;
  setWrong: Setter<number[]>;
}

/**
 * Every action reads the entry at the cursor rather than a session-wide mode:
 * rating belongs to a card, answering and skipping belong to a question, and a
 * mixed queue moves between the two from one index to the next.
 */
export function usePracticeSessionActions({
  activeEntries,
  index,
  progressCards,
  queue,
  questionFailedSenses,
  retrying,
  selected,
  setters,
}: {
  activeEntries: PracticeEntry[];
  index: number;
  progressCards: Record<SenseId, CardProgress>;
  queue: PracticeEntry[];
  questionFailedSenses: SenseId[];
  retrying: boolean;
  selected: number | null;
  setters: SessionSetters;
}) {
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [animateNextCard, setAnimateNextCard] = useState(true);
  const actionPending = useRef(false);
  const rateSense = useLearningStore((store) => store.rateSense);
  const recordQuestion = useLearningStore((store) => store.recordQuestion);

  const cardAt = (position: number) => {
    const entry = activeEntries[position];
    return entry?.kind === "card" ? entry : null;
  };
  const questionAt = (position: number) => {
    const entry = activeEntries[position];
    return entry?.kind === "question" ? entry.item : null;
  };

  const resetAttempt = () => {
    actionPending.current = false;
    setActionBusy(false);
    setPendingChoice(null);
    setters.setIndex(0);
    setters.setCorrect(0);
    setters.setWrong([]);
    setters.setSkipped([]);
    setters.setMarked([]);
    setters.setSelected(null);
    setters.setRevealed(false);
    setters.setAnswerChoices([]);
  };

  const advance = (fromKeyboard = false) => {
    setAnimateNextCard(!fromKeyboard);
    setters.setIndex((value) => value + 1);
    setters.setRevealed(false);
    setters.setSelected(null);
  };

  const next = (fromKeyboard = false) => {
    if (!actionPending.current) advance(fromKeyboard);
  };

  const rate = async (rating: ReviewRating, fromKeyboard = false) => {
    const entry = cardAt(index);
    if (!entry || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      await rateSense(entry.word.id, rating);
      if (rating === "good") setters.setCorrect((value) => value + 1);
      else setters.setWrong((value) => [...value, index]);
      advance(fromKeyboard);
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };

  const answer = async (choice: number) => {
    if (selected !== null || actionPending.current) return;
    const item = questionAt(index);
    if (!item) return;
    actionPending.current = true;
    setActionBusy(true);
    setPendingChoice(choice);
    const isCorrect = isCorrectChoice(item, choice);
    const addedFailedSense =
      !isCorrect && !questionFailedSenses.includes(item.senseId);
    try {
      const card = progressCards[item.senseId];
      const reviewedToday = card?.lastReview
        ? isSameLocalDay(new Date(card.lastReview), new Date())
        : false;
      const rating = addedFailedSense
        ? "again"
        : isCorrect && !reviewedToday
          ? "good"
          : undefined;
      await recordQuestion(
        item.senseId,
        item.type,
        item.difficulty,
        isCorrect,
        retrying,
        rating,
      );
      setters.setSelected(choice);
      setters.setRevealed(true);
      setters.setAnswerChoices((values) => {
        const nextChoices = [...values];
        while (nextChoices.length <= index) nextChoices.push(null);
        nextChoices[index] = choice;
        return nextChoices;
      });
      if (isCorrect) setters.setCorrect((value) => value + 1);
      else setters.setWrong((value) => [...value, index]);
      if (addedFailedSense)
        setters.setQuestionFailedSenses((values) => [...values, item.senseId]);
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
      setPendingChoice(null);
    }
  };

  const skip = async () => {
    const item = questionAt(index);
    if (!item || selected !== null || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      await recordQuestion(
        item.senseId,
        item.type,
        item.difficulty,
        false,
        retrying,
      );
      setters.setSkipped((values) => [...values, index]);
      setters.setWrong((values) => [...values, index]);
      advance();
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };

  const begin = () => {
    setters.setEntries(queue);
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
    setters.setStarted(true);
  };

  const leave = () => {
    if (actionPending.current) return;
    setters.setStarted(false);
    setters.setEntries(null);
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    resetAttempt();
  };

  const retry = (indices: number[]) => {
    setters.setEntries(
      indices.map((value) => activeEntries[value]).filter(Boolean),
    );
    setters.setRetrying(true);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
  };

  return {
    actionBusy,
    pendingChoice,
    animateNextCard,
    answer,
    begin,
    leave,
    next,
    rate,
    retry,
    skip,
  };
}
