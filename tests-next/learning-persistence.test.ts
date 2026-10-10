import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEARNING_STORAGE_KEY } from "@/constants";
import { useLearningStore } from "@/stores/learning-store";
import { asSenseId } from "@/src/lib/library";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { reviewCard } from "@/src/lib/fsrs";
import { mergeProgress, mergeStats } from "@/src/lib/cloud-account";

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  write: vi.fn<(key: string, value: string) => Promise<void>>(),
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => storage.values.get(key),
  set: (key: string, value: string) => storage.write(key, value),
  del: async (key: string) => {
    storage.values.delete(key);
  },
}));
vi.mock("@/src/lib/sync-journal", () => ({
  markBlobDirty: vi.fn(async () => {}),
}));

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
  it("changes only the edited goal while preserving newer stats and the other goal", async () => {
    const store = useLearningStore.getState();
    await store.applyRemoteState((current) => ({
      ...current,
      stats: {
        ...current.stats,
        dailyQuestionGoal: 42,
        totalQuestionReviews: 12,
      },
    }));
    await store.setGoals({ dailyWordGoal: 20 });
    useLearningStore.setState({ loaded: false, stats: createDefaultStats() });
    await store.hydrate();
    expect(useLearningStore.getState().stats).toMatchObject({
      dailyWordGoal: 20,
      dailyQuestionGoal: 42,
      totalQuestionReviews: 12,
    });
  });
  it("persists local meaning answers as questions and word practice", async () => {
    await useLearningStore
      .getState()
      .recordQuestion(asSenseId("bank"), "meaning", 1, true, false, "good");
    useLearningStore.setState({ loaded: false, stats: createDefaultStats() });
    await useLearningStore.getState().hydrate();
    const { stats, progress } = useLearningStore.getState();
    expect(stats.todayMemoryReviews).toBe(1);
    expect(stats.todayQuestionReviews).toBe(1);
    expect(
      stats.questionStatsBySense[asSenseId("bank")]?.["meaning:1"]?.correct,
    ).toBe(1);
    expect(progress.cards[asSenseId("bank")].reviewCount).toBe(1);
  });
  it("keeps counters unchanged when saving an answer fails", async () => {
    storage.write.mockRejectedValueOnce(new Error("disk full"));
    await expect(
      useLearningStore.getState().rateSense(asSenseId("a"), "good"),
    ).rejects.toThrow("disk full");
    expect(useLearningStore.getState().stats.totalMemoryReviews).toBe(0);
    expect(useLearningStore.getState().progress.cards).toEqual({});
  });

  it("keeps concurrent answers without losing a counter", async () => {
    await Promise.all([
      useLearningStore.getState().rateSense(asSenseId("a"), "good"),
      useLearningStore.getState().rateSense(asSenseId("b"), "again"),
    ]);
    expect(useLearningStore.getState().stats.totalMemoryReviews).toBe(2);
    expect(
      Object.keys(useLearningStore.getState().progress.cards),
    ).toHaveLength(2);
  });
  it("imports missing cards without erasing answers queued after selecting the backup, including on retry", async () => {
    const store = useLearningStore.getState();
    const incoming = {
      cards: { [asSenseId("backup")]: reviewCard(null, "good") },
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    await Promise.all([
      store.rateSense(asSenseId("new-answer"), "good"),
      store.importBackup(incoming, createDefaultStats()),
    ]);
    await store.rateSense(asSenseId("new-answer"), "again");
    await store.importBackup(incoming, createDefaultStats());
    expect(useLearningStore.getState().stats.totalMemoryReviews).toBe(2);
    expect(
      useLearningStore.getState().progress.cards[asSenseId("new-answer")]
        .reviewCount,
    ).toBe(2);
    useLearningStore.setState({ loaded: false });
    await store.hydrate();
    expect(useLearningStore.getState().stats.totalMemoryReviews).toBe(2);
    expect(Object.keys(useLearningStore.getState().progress.cards)).toEqual(
      expect.arrayContaining(["backup", "new-answer"]),
    );
  });
  it("merges a remote snapshot with an answer that finished while the snapshot was being read", async () => {
    const store = useLearningStore.getState();
    const old = { cards: {}, updatedAt: "2026-10-01T00:00:00.000Z" };
    const oldStats = createDefaultStats();
    const [, merged] = await Promise.all([
      store.rateSense(asSenseId("new-answer"), "good"),
      store.applyRemoteState((current) => ({
        progress: mergeProgress(current.progress, old),
        stats: mergeStats(current.stats, oldStats),
      })),
    ]);
    expect(merged?.stats.totalMemoryReviews).toBe(1);
    expect(merged?.progress.cards[asSenseId("new-answer")].reviewCount).toBe(1);
    useLearningStore.setState({ loaded: false });
    await store.hydrate();
    expect(useLearningStore.getState().stats.totalMemoryReviews).toBe(1);
  });

  it("refuses unreadable learning data without replacing it with defaults", async () => {
    storage.values.set(`d1-v1:guest:${LEARNING_STORAGE_KEY}`, "broken data");
    useLearningStore.setState({ loaded: false });
    await expect(useLearningStore.getState().hydrate()).rejects.toThrow(
      "原始資料已保留",
    );
    expect(useLearningStore.getState().loaded).toBe(false);
    expect(storage.values.get(`d1-v1:guest:${LEARNING_STORAGE_KEY}`)).toBe(
      "broken data",
    );
    expect(storage.write).not.toHaveBeenCalled();
  });
  it.each(["card", "question"] as const)(
    "waits for the %s write before reporting completion",
    async (kind) => {
      let finishWrite!: () => void;
      storage.write.mockImplementationOnce(
        (key, value) =>
          new Promise<void>((resolve) => {
            finishWrite = () => {
              storage.values.set(key, value);
              resolve();
            };
          }),
      );
      let completed = false;
      const action =
        kind === "card"
          ? useLearningStore.getState().rateSense(asSenseId("sense-a"), "good")
          : useLearningStore
              .getState()
              .recordQuestion(asSenseId("sense-a"), "vocabulary", 2, true);
      const result = action.then(() => {
        completed = true;
      });
      await vi.waitFor(() => expect(storage.write).toHaveBeenCalled());
      expect(completed).toBe(false);
      finishWrite();
      await result;
      const saved = JSON.parse(
        storage.values.get(`d1-v1:guest:${LEARNING_STORAGE_KEY}`)!,
      ) as {
        stats: { totalMemoryReviews: number; totalQuestionReviews: number };
      };
      expect(
        kind === "card"
          ? saved.stats.totalMemoryReviews
          : saved.stats.totalQuestionReviews,
      ).toBe(1);
      useLearningStore.setState({ loaded: false, stats: createDefaultStats() });
      await useLearningStore.getState().hydrate();
      const stats = useLearningStore.getState().stats;
      expect(
        kind === "card" ? stats.totalMemoryReviews : stats.totalQuestionReviews,
      ).toBe(1);
    },
  );
});
