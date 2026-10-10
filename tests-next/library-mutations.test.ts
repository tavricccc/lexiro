import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";
import { prepareWordEdit } from "@/src/lib/word-edit";

const mocks = vi.hoisted(() => ({ commit: vi.fn(), prune: vi.fn() }));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({ commit: mocks.commit }),
}));
vi.mock("@/src/lib/sync-journal", () => ({
  recordLocalChanges: async () => {},
  untrackChanges: async () => {},
}));
vi.mock("@/stores/learning-store", () => ({
  useLearningStore: { getState: () => ({ pruneToSenseIds: mocks.prune }) },
}));

beforeEach(() => {
  mocks.commit.mockReset().mockResolvedValue({ changed: [], removed: [] });
  mocks.prune.mockReset().mockResolvedValue(undefined);
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
});

describe("library mutations", () => {
  it("stores new and edited examples without creating questions or replacing saved ones", async () => {
    const store = useLibraryStore.getState();
    const draft = {
      word: "calm",
      pos: "adj.",
      meaningZh: "平靜的",
      examples: ["The lake was calm after the storm."],
      supplementary: false,
    };
    const savedSet = await store.saveSet({
      setName: "課文單字",
      words: [draft],
    });
    const membership =
      useLibraryStore.getState().state.memberships[savedSet.id][0];
    expect(useLibraryStore.getState().state.questions).toEqual([]);

    await store.saveQuestion({
      id: "saved-question",
      fingerprint: "",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      wordKey: membership.wordKey,
      senseId: membership.senseIds[0],
      prompt: "With no waves in sight, the lake stayed _____.",
      options: ["calm", "rough", "noisy", "crowded"],
      answerIndex: 0,
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    });
    const savedQuestion = useLibraryStore.getState().state.questions[0];
    const examples = [
      "She remained calm while everyone else panicked.",
      "The sea was calm at dawn.",
    ];
    await store.saveSet({
      id: savedSet.id,
      setName: savedSet.setName,
      words: [{ ...draft, examples }],
    });

    const state = useLibraryStore.getState().state;
    expect(state.words[membership.wordKey].senses[0].examples).toEqual(
      examples,
    );
    expect(state.questions).toEqual([savedQuestion]);
    expect(mocks.commit.mock.lastCall![0].questions).toEqual([savedQuestion]);
  });

  it("preserves both simultaneous edits on disk and in memory", async () => {
    const store = useLibraryStore.getState();
    await Promise.all([store.createFolder("學校"), store.createFolder("生活")]);
    expect(
      useLibraryStore.getState().state.folders.map((folder) => folder.name),
    ).toEqual(expect.arrayContaining(["學校", "生活"]));
    expect(mocks.commit.mock.lastCall![0].folders).toHaveLength(3);
  });

  it("keeps matching words, meanings, examples and question content independent across sets", async () => {
    const store = useLibraryStore.getState();
    const draft = {
      word: "calm",
      pos: "adj.",
      meaningZh: "平靜的",
      examples: ["The sea was calm."],
      supplementary: false,
    };
    await store.saveSet({ id: "a", setName: "A", words: [draft] });
    await store.saveSet({ id: "b", setName: "B", words: [draft] });
    const state = useLibraryStore.getState().state;
    const a = state.memberships.a[0];
    const b = state.memberships.b[0];
    expect(a.wordKey).not.toBe(b.wordKey);
    expect(a.senseIds[0]).not.toBe(b.senseIds[0]);
    const question = {
      id: "a-question",
      fingerprint: "",
      kind: "multipleChoice" as const,
      questionStyle: "vocabulary" as const,
      difficulty: 2 as const,
      wordKey: a.wordKey,
      senseId: a.senseIds[0],
      prompt: "The sea remained _____ after the wind died down.",
      options: ["calm", "rough", "noisy", "crowded"],
      answerIndex: 0,
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    };
    expect(await store.saveQuestion(question)).toBe("saved");
    expect(
      await store.saveQuestion({
        ...question,
        id: "b-question",
        wordKey: b.wordKey,
        senseId: b.senseIds[0],
      }),
    ).toBe("saved");
    await store.saveSet(
      prepareWordEdit(useLibraryStore.getState().state, "a", a.wordKey, {
        word: "calm",
        senses: [
          {
            id: a.senseIds[0],
            pos: "adj.",
            meaning: "鎮靜的",
            examples: ["She was calm during the fire."],
            supplementary: false,
          },
        ],
      }),
    );
    const edited = useLibraryStore.getState().state;
    expect(edited.words[b.wordKey]).toEqual(state.words[b.wordKey]);
    expect(edited.questions.map((entry) => entry.id)).toEqual([
      "a-question",
      "b-question",
    ]);
    expect(
      edited.questions[0].kind === "multipleChoice" &&
        edited.questions[0].senseId,
    ).toBe(edited.words[a.wordKey].senses[0].id);
    await store.deleteSet("a");
    expect(useLibraryStore.getState().state.words[b.wordKey]).toEqual(
      state.words[b.wordKey],
    );
    expect(
      useLibraryStore.getState().state.questions.map((entry) => entry.id),
    ).toEqual(["b-question"]);
  });

  it("clears exactly the chosen set only after saving, including hidden historical questions", async () => {
    const store = useLibraryStore.getState();
    const draft = {
      word: "calm",
      pos: "adj.",
      meaningZh: "平靜的",
      examples: ["The sea was calm."],
      supplementary: false,
    };
    await store.saveSet({ id: "a", setName: "A", words: [draft] });
    await store.saveSet({ id: "b", setName: "B", words: [draft] });
    for (const setId of ["a", "b"]) {
      const membership = useLibraryStore.getState().state.memberships[setId][0];
      for (const questionStyle of ["vocabulary", "grammar"] as const)
        await store.saveQuestion({
          id: `${setId}-${questionStyle}`,
          fingerprint: "",
          kind: "multipleChoice",
          questionStyle,
          difficulty: 2,
          wordKey: membership.wordKey,
          senseId: membership.senseIds[0],
          prompt: "The sea was _____.",
          options: ["calm", "rough", "noisy", "crowded"],
          answerIndex: 0,
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
        });
    }
    const before = useLibraryStore.getState().state;
    mocks.commit.mockRejectedValueOnce(new Error("disk full"));
    await expect(store.clearQuestions("a")).rejects.toThrow("disk full");
    expect(useLibraryStore.getState().state).toBe(before);
    await store.clearQuestions("a");
    expect(
      useLibraryStore.getState().state.questions.map((entry) => entry.id),
    ).toEqual(["b-vocabulary", "b-grammar"]);
    expect(useLibraryStore.getState().state.words).toEqual(before.words);
    expect(mocks.prune).not.toHaveBeenCalled();
    await store.clearQuestions();
    expect(useLibraryStore.getState().state.questions).toEqual([]);
    expect(useLibraryStore.getState().state.words).toEqual(before.words);
  });

  it("continues the queue after a failed write without publishing unsaved data", async () => {
    mocks.commit.mockRejectedValueOnce(new Error("disk full"));
    const store = useLibraryStore.getState();
    const failed = store.createFolder("未儲存");
    const saved = store.createFolder("已儲存");
    await expect(failed).rejects.toThrow("disk full");
    await saved;
    expect(
      useLibraryStore.getState().state.folders.map((folder) => folder.name),
    ).toEqual(expect.arrayContaining(["已儲存"]));
    expect(
      useLibraryStore
        .getState()
        .state.folders.some((folder) => folder.name === "未儲存"),
    ).toBe(false);
  });
  it("merges an import with edits queued after the backup was selected", async () => {
    const store = useLibraryStore.getState();
    const incoming = emptyLibraryState();
    await Promise.all([
      store.createFolder("較新的資料"),
      store.importState(incoming),
    ]);
    expect(
      useLibraryStore
        .getState()
        .state.folders.some((folder) => folder.name === "較新的資料"),
    ).toBe(true);
    expect(
      mocks.commit.mock.lastCall![0].folders.some(
        (folder: { name: string }) => folder.name === "較新的資料",
      ),
    ).toBe(true);
  });
  it("merges remote changes inside the queue so a preceding local edit survives", async () => {
    const store = useLibraryStore.getState();
    const remote = store.applyRemoteState;
    await Promise.all([
      store.createFolder("同步途中新增"),
      remote(async (current) => ({
        ...current,
        updatedAt: "2026-10-02T00:00:00.000Z",
      })),
    ]);
    expect(
      mocks.commit.mock.lastCall![0].folders.some(
        (folder: { name: string }) => folder.name === "同步途中新增",
      ),
    ).toBe(true);
  });
});
