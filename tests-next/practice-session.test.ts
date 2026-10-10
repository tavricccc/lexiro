import { describe, expect, it } from "vitest";

import {
  canRestorePracticeSession,
  parsePracticeSession,
} from "@/src/lib/practice-session";

const validSession = {
  schemaVersion: 5,
  meaningChoices: {},
  tasks: ["vocabulary", "reading"],
  setId: "set-1",
  amount: 10,
  index: 1,
  correct: 1,
  wrong: [1],
  skipped: [],
  marked: [1],
  selected: 2,
  revealed: true,
  difficulty: "all",
  entryIds: ["question:one", "question:two"],
  failedSenseIds: ["sense-one"],
  retrying: false,
  answerChoices: [null, 2],
};

describe("practice session persistence", () => {
  it("restores a valid answered question without losing the current choice", () => {
    expect(parsePracticeSession(JSON.stringify(validSession))).toEqual(
      validSession,
    );
  });

  it("migrates mixed retired tasks without losing saved answers or repeating completed items", () => {
    const session = {
      ...validSession,
      schemaVersion: 4,
      tasks: ["spelling", "grammar", "meaning", "reading"],
      entryIds: [
        "card:spelling:s1",
        "meaning:s2",
        "question:grammar",
        "reading:one:c1",
      ],
      index: 3,
      selected: 2,
      correct: 2,
      wrong: [1, 2],
      skipped: [2],
      marked: [0, 3],
      answerChoices: [null, 0, null, 2],
    };
    expect(
      parsePracticeSession(
        JSON.stringify(session),
        new Set(["question:grammar"]),
      ),
    ).toMatchObject({
      schemaVersion: 5,
      tasks: ["meaning", "reading"],
      entryIds: ["meaning:s2", "reading:one:c1"],
      index: 1,
      correct: 1,
      wrong: [0],
      skipped: [],
      marked: [1],
      selected: 2,
      answerChoices: [0, 2],
    });
  });

  it("ends an unfinished session containing only removed modes", () => {
    expect(
      parsePracticeSession(
        JSON.stringify({
          ...validSession,
          schemaVersion: 4,
          tasks: ["spelling"],
          entryIds: ["card:spelling:s1"],
          index: 0,
          correct: 0,
          wrong: [],
          marked: [],
          answerChoices: [null],
          selected: null,
        }),
      ),
    ).toBeNull();
  });

  it("accepts a choice from a ten-option 文意選填 bank", () => {
    const session = { ...validSession, selected: 9, answerChoices: [null, 9] };
    expect(parsePracticeSession(JSON.stringify(session))?.selected).toBe(9);
  });

  it("retains saved shared-bank option order while bounding its answer index", () => {
    const options = Array.from({ length: 10 }, (_, index) => `option ${index}`);
    const session = {
      ...validSession,
      meaningChoices: { "question:one": { options, answerIndex: 9 } },
    };
    expect(
      parsePracticeSession(JSON.stringify(session))?.meaningChoices,
    ).toEqual(session.meaningChoices);
    expect(
      parsePracticeSession(
        JSON.stringify({
          ...session,
          meaningChoices: { "question:one": { options, answerIndex: 10 } },
        }),
      ),
    ).toBeNull();
  });

  it("restores a session with more than one hundred questions", () => {
    const session = {
      ...validSession,
      amount: 120,
      entryIds: Array.from({ length: 120 }, (_, index) => `question:${index}`),
      answerChoices: Array.from({ length: 120 }, () => null),
    };
    expect(parsePracticeSession(JSON.stringify(session))?.amount).toBe(120);
  });

  it("rejects invalid answer choices", () => {
    expect(
      parsePracticeSession(
        JSON.stringify({ ...validSession, answerChoices: [0, 12] }),
      ),
    ).toBeNull();
    expect(
      parsePracticeSession(
        JSON.stringify({ ...validSession, answerChoices: ["yes"] }),
      ),
    ).toBeNull();
    expect(
      parsePracticeSession(
        JSON.stringify({ ...validSession, answerChoices: [null, null, null] }),
      ),
    ).toBeNull();
  });

  it("drops the superseded single-mode snapshots instead of guessing a queue", () => {
    const { tasks: _tasks, entryIds, ...rest } = validSession;
    const legacy = {
      ...rest,
      schemaVersion: 2,
      mode: "questions",
      questionType: "all",
      itemIds: entryIds,
    };
    expect(parsePracticeSession(JSON.stringify(legacy))).toBeNull();
  });

  it("rejects incomplete sessions, unknown tasks and invalid queues", () => {
    expect(
      parsePracticeSession(JSON.stringify({ schemaVersion: 3, index: 1 })),
    ).toBeNull();
    expect(
      parsePracticeSession(
        JSON.stringify({ ...validSession, tasks: ["nonsense"] }),
      ),
    ).toBeNull();
    expect(
      parsePracticeSession(JSON.stringify({ ...validSession, tasks: [] })),
    ).toBeNull();
    expect(
      parsePracticeSession(
        JSON.stringify({ ...validSession, entryIds: ["same", "same"] }),
      ),
    ).toBeNull();
    expect(
      parsePracticeSession(JSON.stringify({ ...validSession, index: 2 })),
    ).toBeNull();
  });

  it("rejects corrupt JSON instead of throwing during hydration", () => {
    expect(parsePracticeSession("{not-json")).toBeNull();
  });

  it("restores a session after refreshing the practice route", () => {
    const session = parsePracticeSession(JSON.stringify(validSession));
    expect(session).not.toBeNull();
    expect(canRestorePracticeSession(session!, "")).toBe(true);
  });

  it("does not override an explicit set route with an unrelated session", () => {
    const session = parsePracticeSession(JSON.stringify(validSession));
    expect(session).not.toBeNull();
    expect(canRestorePracticeSession(session!, "set-2")).toBe(false);
    expect(canRestorePracticeSession(session!, "set-1")).toBe(true);
  });
});
