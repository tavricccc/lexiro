import type { LibraryQuestion, SenseId, StudyWord, WordKey } from "@/types";
import { describe, expect, it, vi } from "vitest";

import { buildQuestionGroups } from "@/components/practice/practice-content";
import { buildPracticeQueue } from "@/components/practice/practice-queue";
import {
  normalizeRoomCode,
  ROOM_CODE_PATTERN,
  ROOM_MAX_QUESTIONS,
  roomSocketUrl,
  toRoomQuestions,
} from "@/lib/room-client";

function word(index: number): StudyWord {
  return {
    id: `sense-${index}` as SenseId,
    wordKey: `word-${index}` as WordKey,
    word: `word${index}`,
    pos: "n.",
    meaning: `意思 ${index}`,
    supplementary: false,
    examples: [],
    example: "",
  };
}

const readingPack: LibraryQuestion = {
  kind: "reading",
  id: "r-1",
  fingerprint: "fp-r-1",
  wordKeys: ["word-1" as WordKey],
  title: "A passage",
  format: "reading",
  difficulty: 2,
  passage: "Some passage text.",
  questions: [
    {
      id: "c-1",
      kind: "multipleChoice",
      wordKey: "word-1" as WordKey,
      senseId: "sense-1" as SenseId,
      prompt: "What is it about?",
      options: ["a", "b", "c", "d"],
      answerIndex: 1,
      explanation: "Because b.",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const studyItems = [1, 2, 3, 4].map(word);
const queue = buildPracticeQueue({
  allowedSenseIds: new Set(studyItems.map((item) => item.id)),
  amount: 5,
  difficulty: "all",
  oneSensePerWord: false,
  questionGroups: buildQuestionGroups([readingPack], {}),
  studyItems,
  tasks: ["meaning", "reading"],
});

describe("room questions", () => {
  it("keeps the answer and explanation out of what players are shown", () => {
    const questions = toRoomQuestions(queue);
    expect(questions.length).toBe(queue.length);
    for (const [index, question] of questions.entries()) {
      expect(question.answerIndex).toBe(queue[index].item.answerIndex);
      expect(Object.keys(question.display)).not.toContain("answerIndex");
      expect(JSON.stringify(question.display)).not.toContain("Because b.");
    }
    const reading = questions.find((question) => question.display.passage);
    expect(reading?.display.passage).toEqual({
      id: "r-1",
      title: "A passage",
      text: "Some passage text.",
    });
    expect(reading?.explanation).toBe("Because b.");
  });

  it("never sends more than a room holds", () => {
    expect(toRoomQuestions(Array(80).fill(queue[0]))).toHaveLength(
      ROOM_MAX_QUESTIONS,
    );
  });

  it("reads a typed code the way the server writes it", () => {
    expect(normalizeRoomCode(" ab-c 2x9 ")).toBe("ABC2X9");
    expect(ROOM_CODE_PATTERN.test("ABC2X9")).toBe(true);
    // 0, 1, I and O are never issued; they read too alike aloud.
    expect(ROOM_CODE_PATTERN.test("ABC1X0")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_AGENT_WORKER_URL", "https://agent.example/");
    expect(roomSocketUrl("ABC2X9", "t-1")).toBe(
      "wss://agent.example/rooms/ABC2X9/ws?ticket=t-1",
    );
    vi.unstubAllEnvs();
  });
});
