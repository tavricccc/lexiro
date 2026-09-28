import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";

const mocks = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({ commit: mocks.commit }),
}));
vi.mock("@/src/lib/sync-journal", () => ({
  recordLocalChanges: async () => {},
  untrackChanges: async () => {},
}));

beforeEach(() => {
  mocks.commit.mockReset().mockResolvedValue({ changed: [], removed: [] });
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
});

describe("library mutations", () => {
  it("preserves both simultaneous edits on disk and in memory", async () => {
    const store = useLibraryStore.getState();
    await Promise.all([store.createFolder("學校"), store.createFolder("生活")]);
    expect(useLibraryStore.getState().state.folders.map((folder) => folder.name)).toEqual(
      expect.arrayContaining(["學校", "生活"]),
    );
    expect(mocks.commit.mock.lastCall![0].folders).toHaveLength(3);
  });

  it("continues the queue after a failed write without publishing unsaved data", async () => {
    mocks.commit.mockRejectedValueOnce(new Error("disk full"));
    const store = useLibraryStore.getState();
    const failed = store.createFolder("未儲存");
    const saved = store.createFolder("已儲存");
    await expect(failed).rejects.toThrow("disk full");
    await saved;
    expect(useLibraryStore.getState().state.folders.map((folder) => folder.name)).toEqual(
      expect.arrayContaining(["已儲存"]),
    );
    expect(useLibraryStore.getState().state.folders.some((folder) => folder.name === "未儲存")).toBe(false);
  });
});
