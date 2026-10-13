"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import type { PracticeEntry } from "@/components/practice/practice-queue";
import { isCorrectChoice } from "./meaning-questions";
import type { SenseId } from "@/types";

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

/** Every action reads the entry at the cursor; nothing is recorded beyond the session. */
export function usePracticeSessionActions({
  activeEntries,
  index,
  queue,
  questionFailedSenses,
  selected,
  setters,
}: {
  activeEntries: PracticeEntry[];
  index: number;
  queue: PracticeEntry[];
  questionFailedSenses: SenseId[];
  selected: number | null;
  setters: SessionSetters;
}) {
  const [animateNextCard, setAnimateNextCard] = useState(true);

  const questionAt = (position: number) => {
    const entry = activeEntries[position];
    return entry?.kind === "question" ? entry.item : null;
  };

  const resetAttempt = () => {
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

  const next = (fromKeyboard = false) => advance(fromKeyboard);

  const answer = (choice: number) => {
    if (selected !== null) return;
    const item = questionAt(index);
    if (!item) return;
    const isCorrect = isCorrectChoice(item, choice);
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
    if (!isCorrect && !questionFailedSenses.includes(item.senseId))
      setters.setQuestionFailedSenses((values) => [...values, item.senseId]);
  };

  const skip = () => {
    if (!questionAt(index) || selected !== null) return;
    setters.setSkipped((values) => [...values, index]);
    setters.setWrong((values) => [...values, index]);
    advance();
  };

  const begin = () => {
    setters.setEntries(queue);
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
    setters.setStarted(true);
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
    animateNextCard,
    answer,
    begin,
    next,
    retry,
    skip,
  };
}
