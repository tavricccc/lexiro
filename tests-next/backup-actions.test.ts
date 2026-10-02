import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { createFullBackup } from "@/src/lib/full-backup";
import { getStorageNamespace, setStorageNamespace } from "@/src/lib/persist";
import { serializeAccountDataAction } from "@/src/lib/account-data-queue";

const actions = vi.hoisted(() => ({
  library: vi.fn(),
  learning: vi.fn(),
  flushLibrary: vi.fn(),
  flushLearning: vi.fn(),
}));
const library = emptyLibraryState();
const progress = { cards: {}, updatedAt: "2026-10-02T00:00:00.000Z" };
const stats = createDefaultStats();
vi.mock("@/stores/library-store", () => ({
  useLibraryStore: {
    getState: () => ({ state: library, importState: actions.library }),
  },
  flushLibraryMutations: actions.flushLibrary,
}));
vi.mock("@/stores/learning-store", () => ({
  useLearningStore: {
    getState: () => ({ progress, stats, importBackup: actions.learning }),
  },
  flushLearningMutations: actions.flushLearning,
}));
const { importFullBackup, prepareFullBackup } =
  await import("@/lib/backup-actions");

beforeEach(() => {
  setStorageNamespace("account-a");
  Object.values(actions).forEach((action) =>
    action.mockReset().mockResolvedValue(undefined),
  );
});
afterEach(() => setStorageNamespace("guest"));

describe("account-scoped backup operations", () => {
  it("keeps both import saves in the original account before switching", async () => {
    let finishLibrary!: () => void;
    actions.library.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLibrary = resolve;
        }),
    );
    actions.learning.mockImplementationOnce(async () => {
      expect(getStorageNamespace()).toBe("account-a");
    });
    const imported = importFullBackup(
      createFullBackup(library, progress, stats),
      "account-a",
    );
    const switchAccount = serializeAccountDataAction(async () =>
      setStorageNamespace("account-b"),
    );
    const switched = switchAccount();
    await vi.waitFor(() => expect(actions.library).toHaveBeenCalledOnce());
    expect(getStorageNamespace()).toBe("account-a");
    finishLibrary();
    await imported;
    await switched;
    expect(actions.learning).toHaveBeenCalledOnce();
    expect(getStorageNamespace()).toBe("account-b");
  });
  it("rejects a backup selected for another account before writing either store", async () => {
    const switchAccount = serializeAccountDataAction(async () =>
      setStorageNamespace("account-b"),
    );
    const switched = switchAccount();
    const imported = importFullBackup(
      createFullBackup(library, progress, stats),
      "account-a",
    );
    await switched;
    await expect(imported).rejects.toThrow("帳號已切換");
    expect(actions.library).not.toHaveBeenCalled();
    expect(actions.learning).not.toHaveBeenCalled();
    await expect(prepareFullBackup("account-a")).rejects.toThrow("重新匯出");
    expect(actions.flushLibrary).not.toHaveBeenCalled();
  });
  it("waits for pending writes before preparing an export", async () => {
    let finishLearning!: () => void;
    actions.flushLearning.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLearning = resolve;
        }),
    );
    let completed = false;
    const exported = prepareFullBackup("account-a").then((value) => {
      completed = true;
      return value;
    });
    await vi.waitFor(() =>
      expect(actions.flushLearning).toHaveBeenCalledOnce(),
    );
    expect(actions.flushLibrary).toHaveBeenCalledOnce();
    expect(completed).toBe(false);
    finishLearning();
    expect((await exported).library).toBe(library);
  });
});
