import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEARNING_STORAGE_KEY } from "@/constants";
import { useLearningStore } from "@/stores/learning-store";
import { asSenseId } from "@/src/lib/library";
import { createDefaultStats } from "@/src/lib/learning-defaults";

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  write: vi.fn<(key: string, value: string) => Promise<void>>(),
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => storage.values.get(key),
  set: (key: string, value: string) => storage.write(key, value),
  del: async (key: string) => { storage.values.delete(key); },
}));
vi.mock("@/src/lib/sync-journal", () => ({ markBlobDirty: vi.fn(async () => {}) }));

beforeEach(() => {
  storage.values.clear();
  storage.write.mockReset().mockImplementation(async (key, value) => {
    storage.values.set(key, value);
  });
  useLearningStore.setState({
    loaded: true,
    progress: { cards: {}, updatedAt: new Date().toISOString() },
    stats: createDefaultStats(),
  });
});

describe("durable practice completion", () => {
  it.each(["card", "question"] as const)("waits for the %s write before reporting completion", async (kind) => {
    let finishWrite!: () => void;
    storage.write.mockImplementationOnce((key, value) => new Promise<void>((resolve) => {
      finishWrite = () => { storage.values.set(key, value); resolve(); };
    }));
    let completed = false;
    const action = kind === "card"
      ? useLearningStore.getState().rateSense(asSenseId("sense-a"), "good")
      : useLearningStore.getState().recordQuestion(asSenseId("sense-a"), "vocabulary", 2, true);
    const result = action.then(() => { completed = true; });
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalled());
    expect(completed).toBe(false);
    finishWrite();
    await result;
    const saved = JSON.parse(storage.values.get(`guest:${LEARNING_STORAGE_KEY}`)!) as {
      stats: { totalMemoryReviews: number; totalQuestionReviews: number };
    };
    expect(kind === "card" ? saved.stats.totalMemoryReviews : saved.stats.totalQuestionReviews).toBe(1);
    useLearningStore.setState({ loaded: false, stats: createDefaultStats() });
    await useLearningStore.getState().hydrate();
    const stats = useLearningStore.getState().stats;
    expect(kind === "card" ? stats.totalMemoryReviews : stats.totalQuestionReviews).toBe(1);
  });
});
