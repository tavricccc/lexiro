import { describe, expect, it } from "vitest";
import {
  emptyLearningRecord,
  mergeLearningRecords,
  overlayLearningRecord,
  recordAnswer,
  recordOwnAnswer,
  trimLearningRecord,
  type LearningRecord,
} from "@/src/lib/learning-record";
import { normalizeFullBackupPayload } from "@/src/lib/share";
import { createFullBackup } from "@/src/lib/full-backup";
import { emptyLibraryState } from "@/src/lib/library-repository";

const answer = (day: string, correct = true, senseId = "s1") => ({
  day,
  senseId,
  wordKey: "set:word",
  kind: "meaning",
  correct,
});
const answered = (...days: string[]) =>
  days.reduce(
    (record, day) => recordAnswer(record, answer(day)),
    emptyLearningRecord(),
  );

describe("merging learning records across devices", () => {
  it("adds answer counts for the same day", () => {
    const merged = mergeLearningRecords([
      answered("2026-11-10"),
      answered("2026-11-10", "2026-11-10"),
    ]);
    expect(merged.days["2026-11-10"]).toEqual({ answered: 3, correct: 3 });
  });
  it("adds answer counts per question type", () => {
    const merged = mergeLearningRecords([
      answered("2026-11-10"),
      answered("2026-11-09"),
    ]);
    expect(merged.kinds.meaning).toEqual({ answered: 2, correct: 2 });
  });
  it("takes the familiarity answered most recently", () => {
    const recent = recordAnswer(
      emptyLearningRecord(),
      answer("2026-11-10", false),
    );
    const merged = mergeLearningRecords([
      answered("2026-11-01", "2026-11-02", "2026-11-03"),
      recent,
    ]);
    expect(merged.senses.s1.level).toBe(0);
  });
  it("takes the higher familiarity on the same day", () => {
    const merged = mergeLearningRecords([
      answered("2026-11-10"),
      answered("2026-11-10", "2026-11-10"),
    ]);
    expect(merged.senses.s1.level).toBe(2);
  });
  it("adds a sense's answers from every device", () => {
    const merged = mergeLearningRecords([
      answered("2026-11-10"),
      answered("2026-11-09"),
    ]);
    expect(merged.senses.s1.answered).toBe(2);
  });
  it("keeps the goal chosen last", () => {
    const early: LearningRecord = {
      ...emptyLearningRecord(),
      goal: 10,
      goalUpdatedAt: "2026-11-01T00:00:00.000Z",
    };
    const late: LearningRecord = {
      ...emptyLearningRecord(),
      goal: 30,
      goalUpdatedAt: "2026-11-05T00:00:00.000Z",
    };
    expect(mergeLearningRecords([late, early]).goal).toBe(30);
  });
  it("prefers a chosen goal over a device that never chose one", () => {
    const chosen: LearningRecord = {
      ...emptyLearningRecord(),
      goal: 10,
      goalUpdatedAt: "2026-11-01T00:00:00.000Z",
    };
    expect(mergeLearningRecords([emptyLearningRecord(), chosen]).goal).toBe(10);
  });
});

describe("answering on a synced device", () => {
  it("moves familiarity from the merged level", () => {
    const merged = answered("2026-11-01", "2026-11-02");
    const own = recordOwnAnswer(
      emptyLearningRecord(),
      merged,
      answer("2026-11-03"),
    );
    expect(own.senses.s1.level).toBe(3);
  });
  it("counts only this device's answers in its own record", () => {
    const merged = answered("2026-11-01", "2026-11-02");
    const own = recordOwnAnswer(
      emptyLearningRecord(),
      merged,
      answer("2026-11-03"),
    );
    expect(own.senses.s1.answered).toBe(1);
  });
});

describe("restoring a backup", () => {
  it("does not count the same answers twice", () => {
    const record = answered("2026-11-10", "2026-11-10");
    expect(
      overlayLearningRecord(record, record).days["2026-11-10"].answered,
    ).toBe(2);
  });
  it("reads the learning record back from a backup", () => {
    const record = answered("2026-11-10");
    const backup = normalizeFullBackupPayload(
      JSON.parse(JSON.stringify(createFullBackup(emptyLibraryState(), record))),
    );
    expect(backup.learning).toEqual(record);
  });
});

describe("keeping a record under the cloud limit", () => {
  it("leaves a small record unchanged", () => {
    const record = answered("2026-11-10");
    expect(trimLearningRecord(record, 10_000)).toBe(record);
  });
  it("drops the senses answered longest ago first", () => {
    let record = emptyLearningRecord();
    for (let i = 0; i < 200; i++)
      record = recordAnswer(
        record,
        answer(
          `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
          true,
          `sense-${i}`,
        ),
      );
    record = recordAnswer(record, answer("2026-11-10", true, "newest"));
    const trimmed = trimLearningRecord(record, 4_000);
    expect(JSON.stringify(trimmed).length).toBeLessThanOrEqual(4_000);
    expect(trimmed.senses.newest).toBeDefined();
  });
});
