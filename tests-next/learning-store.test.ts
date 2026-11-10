import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningStore } from "@/stores/learning-store";
import { setStorageNamespace } from "@/src/lib/persist";
const answer = {
  senseId: "sense",
  wordKey: "word",
  kind: "meaning",
  correct: true,
  day: "2026-11-11",
};
describe("device learning persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    setStorageNamespace("learning-test");
    useLearningStore.getState().hydrate();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setStorageNamespace("d1-v1:guest");
  });
  it("restores confirmed answers and the daily goal", () => {
    useLearningStore.getState().answer(answer);
    useLearningStore.getState().setGoal(30);
    useLearningStore.getState().hydrate();
    expect(useLearningStore.getState().record.goal).toBe(30);
    expect(useLearningStore.getState().record.days[answer.day]).toEqual({
      answered: 1,
      correct: 1,
    });
  });
  it("keeps different accounts' learning records separate", () => {
    useLearningStore.getState().answer(answer);
    setStorageNamespace("another-account");
    useLearningStore.getState().hydrate();
    expect(useLearningStore.getState().record.days).toEqual({});
    setStorageNamespace("learning-test");
    useLearningStore.getState().hydrate();
    expect(useLearningStore.getState().record.days[answer.day].answered).toBe(
      1,
    );
  });
  it("reports failed persistence without claiming the answer was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    useLearningStore.getState().answer(answer);
    expect(useLearningStore.getState().record.days).toEqual({});
    expect(useLearningStore.getState().error).toBe("儲存失敗");
  });
  it("shows another device's answers next to this device's", () => {
    useLearningStore.getState().answer(answer);
    const other = {
      version: 1 as const,
      goal: 20 as const,
      days: { [answer.day]: { answered: 2, correct: 1 } },
      kinds: {},
      senses: {},
    };
    useLearningStore.getState().applyCloud({ "other-device": other });
    expect(useLearningStore.getState().record.days[answer.day]).toEqual({
      answered: 3,
      correct: 2,
    });
  });
  it("keeps another device's answers out of this device's own record", () => {
    const other = {
      version: 1 as const,
      goal: 20 as const,
      days: { [answer.day]: { answered: 2, correct: 1 } },
      kinds: {},
      senses: {},
    };
    useLearningStore.getState().applyCloud({ "other-device": other });
    useLearningStore.getState().answer(answer);
    expect(useLearningStore.getState().own.days[answer.day]).toEqual({
      answered: 1,
      correct: 1,
    });
  });
  it("still owes a push after an answer made while the last one was in flight", () => {
    useLearningStore.getState().answer(answer);
    const sent = useLearningStore.getState().own;
    useLearningStore.getState().answer(answer);
    useLearningStore.getState().markPushed(sent);
    expect(useLearningStore.getState().cache.dirty).toBe(true);
  });
  it("owes no push once the record reached the cloud unchanged", () => {
    useLearningStore.getState().answer(answer);
    useLearningStore.getState().markPushed(useLearningStore.getState().own);
    useLearningStore.getState().hydrate();
    expect(useLearningStore.getState().cache.dirty).toBe(false);
  });
});
