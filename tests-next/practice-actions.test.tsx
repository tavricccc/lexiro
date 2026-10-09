import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePracticeSessionActions } from "@/components/practice/use-practice-session-actions";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import type { SenseId } from "@/types";

const { recordQuestion, rateSense, showError } = vi.hoisted(() => ({
  recordQuestion: vi.fn(),
  rateSense: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("@/stores/learning-store", () => ({
  useLearningStore: (select: (store: unknown) => unknown) =>
    select({ recordQuestion, rateSense }),
}));
vi.mock("sonner", () => ({ toast: { error: showError } }));

const entry: PracticeEntry = {
  id: "question:one",
  kind: "question",
  task: "vocabulary",
  item: {
    id: "question:one",
    question: null,
    type: "vocabulary",
    prompt: "The committee reached a decision.",
    options: ["agreement", "confusion", "attention", "delay"],
    answerIndex: 0,
    wordKey: "agreement",
    senseId: "agreement-sense",
    difficulty: 2,
    meaning: "協議",
  },
};

function useSession() {
  const [answerChoices, setAnswerChoices] = useState<Array<number | null>>([]);
  const [correct, setCorrect] = useState(0);
  const [entries, setEntries] = useState<PracticeEntry[] | null>([entry]);
  const [index, setIndex] = useState(0);
  const [marked, setMarked] = useState<number[]>([]);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<SenseId[]>(
    [],
  );
  const [retrying, setRetrying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [started, setStarted] = useState(true);
  const [wrong, setWrong] = useState<number[]>([]);
  const actions = usePracticeSessionActions({
    activeEntries: entries ?? [],
    index,
    progressCards: {},
    queue: [entry],
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
  return {
    actions,
    state: {
      answerChoices,
      correct,
      entries,
      index,
      marked,
      questionFailedSenses,
      retrying,
      revealed,
      selected,
      skipped,
      started,
      wrong,
    },
  };
}

function pendingRecord() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  recordQuestion.mockReturnValueOnce(
    new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    }),
  );
  return { resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("practice action persistence", () => {
  it("only publishes the answer after recording succeeds and keeps the session active while saving", async () => {
    const pending = pendingRecord();
    const { result } = renderHook(useSession);
    let task!: Promise<void>;
    act(() => {
      task = result.current.actions.answer(0);
    });
    expect(result.current.actions.pendingChoice).toBe(0);
    expect(result.current.actions.actionBusy).toBe(true);
    expect(result.current.state).toMatchObject({
      selected: null,
      revealed: false,
      answerChoices: [],
      correct: 0,
    });
    act(() => result.current.actions.leave());
    expect(result.current.state.started).toBe(true);
    await act(async () => {
      pending.resolve();
      await task;
    });
    expect(result.current.state).toMatchObject({
      selected: 0,
      revealed: true,
      answerChoices: [0],
      correct: 1,
    });
    expect(result.current.actions.pendingChoice).toBeNull();
  });

  it("leaves an unanswered session intact when recording fails", async () => {
    const pending = pendingRecord();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(useSession);
    let task!: Promise<void>;
    act(() => {
      task = result.current.actions.answer(1);
    });
    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await task;
    });
    expect(result.current.state).toMatchObject({
      selected: null,
      revealed: false,
      answerChoices: [],
      correct: 0,
      wrong: [],
      questionFailedSenses: [],
      index: 0,
    });
    expect(result.current.actions.actionBusy).toBe(false);
    expect(result.current.actions.recordFailed).toBe(true);
    expect(showError).toHaveBeenCalledOnce();
    recordQuestion.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.actions.answer(0);
    });
    expect(result.current.actions.recordFailed).toBe(false);
    expect(result.current.state).toMatchObject({ selected: 0, correct: 1 });
  });

  it("only counts a skipped question after recording succeeds", async () => {
    const pending = pendingRecord();
    const { result } = renderHook(useSession);
    let task!: Promise<void>;
    act(() => {
      task = result.current.actions.skip();
    });
    expect(result.current.state).toMatchObject({
      skipped: [],
      wrong: [],
      index: 0,
    });
    await act(async () => {
      pending.resolve();
      await task;
    });
    expect(result.current.state).toMatchObject({
      skipped: [0],
      wrong: [0],
      index: 1,
    });
  });
});
