"use client";

import { useState } from "react";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { DEFAULT_CARD_TASKS, DEFAULT_QUESTION_TASKS } from "@/constants";
import { useCloudStore } from "@/stores/cloud-store";
import type { PracticeTask, PracticeTrack, WorkspaceQuestionDifficulty } from "@/types";

interface PracticeSetupDraft {
  amount: number;
  difficulty: WorkspaceQuestionDifficulty;
  leechOnly: boolean;
  oneSensePerWord: boolean;
  setId: string;
  tasks: PracticeTask[];
  track: PracticeTrack | null;
}

export function usePracticeSetupChoices(initialSet: string, initialTrack?: PracticeTrack) {
  const uid = useCloudStore((store) => store.user?.uid);
  const initialTasks = () => initialTrack === "questions" ? [...DEFAULT_QUESTION_TASKS] : [...DEFAULT_CARD_TASKS];
  const saved = useResumableDraft<PracticeSetupDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:practice-setup:${initialSet || "all"}:${initialTrack ?? "choose"}`,
    {
      amount: 10,
      difficulty: "all",
      leechOnly: false,
      oneSensePerWord: true,
      setId: initialSet,
      tasks: initialTasks(),
      track: initialTrack ?? null,
    },
  );
  const [tasks, setTasks] = useState<PracticeTask[]>(initialTasks);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<WorkspaceQuestionDifficulty>("all");
  const [leechOnly, setLeechOnly] = useState(false);
  const [oneSensePerWord, setOneSensePerWord] = useState(true);
  const [track, setTrack] = useState<PracticeTrack | null>(initialTrack ?? null);

  const reset = () => {
    setTasks(initialTasks());
    setSetId(initialSet);
    setAmount(10);
    setDifficulty("all");
    setLeechOnly(false);
    setOneSensePerWord(true);
    setTrack(initialTrack ?? null);
  };
  const restart = () => {
    saved.restart();
    reset();
  };
  const resume = () => {
    const draft = saved.pending!;
    saved.resume();
    setTasks(draft.tasks);
    setSetId(draft.setId);
    setAmount(draft.amount);
    setDifficulty(draft.difficulty);
    setLeechOnly(draft.leechOnly);
    setOneSensePerWord(draft.oneSensePerWord);
    setTrack(draft.track);
  };

  return {
    amount,
    difficulty,
    leechOnly,
    oneSensePerWord,
    setId,
    tasks,
    track,
    saved,
    reset,
    restart,
    resume,
    changeAmount: (value: number) => { setAmount(value); saved.update({ amount: value }); },
    changeDifficulty: (value: WorkspaceQuestionDifficulty) => { setDifficulty(value); saved.update({ difficulty: value }); },
    changeLeechOnly: (value: boolean) => { setLeechOnly(value); saved.update({ leechOnly: value }); },
    changeOneSense: (value: boolean) => { setOneSensePerWord(value); saved.update({ oneSensePerWord: value }); },
    changeSet: (value: string) => { setSetId(value); saved.update({ setId: value }); },
    changeTasks: (value: PracticeTask[]) => { setTasks(value); saved.update({ tasks: value }); },
    changeTrack: (value: PracticeTrack | null) => { setTrack(value); saved.update({ track: value }); },
    clear: saved.clear,
    restoreSessionChoices: (value: { tasks: PracticeTask[]; setId: string; amount: number; difficulty: WorkspaceQuestionDifficulty }) => {
      setTasks(value.tasks);
      setSetId(value.setId);
      setAmount(value.amount);
      setDifficulty(value.difficulty);
    },
  };
}
