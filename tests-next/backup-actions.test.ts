import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { createFullBackup } from "@/src/lib/full-backup";
import { getStorageNamespace, setStorageNamespace } from "@/src/lib/persist";
import { serializeAccountDataAction } from "@/src/lib/account-data-queue";

const actions = vi.hoisted(() => ({
  library: vi.fn(),
  flushLibrary: vi.fn(),
}));
const library = emptyLibraryState();
vi.mock("@/stores/library-store", () => ({
  useLibraryStore: {
    getState: () => ({ state: library, importState: actions.library }),
  },
  flushLibraryMutations: actions.flushLibrary,
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
  it("keeps the import save in the original account before switching", async () => {
    let finishLibrary!: () => void;
    actions.library.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLibrary = resolve;
        }),
    );
    const imported = importFullBackup(createFullBackup(library), "account-a");
    const switchAccount = serializeAccountDataAction(async () =>
      setStorageNamespace("account-b"),
    );
    const switched = switchAccount();
    await vi.waitFor(() => expect(actions.library).toHaveBeenCalledOnce());
    expect(getStorageNamespace()).toBe("account-a");
    finishLibrary();
    await imported;
    await switched;
    expect(getStorageNamespace()).toBe("account-b");
  });
  it("rejects a backup selected for another account before writing", async () => {
    const switchAccount = serializeAccountDataAction(async () =>
      setStorageNamespace("account-b"),
    );
    const switched = switchAccount();
    const imported = importFullBackup(createFullBackup(library), "account-a");
    await switched;
    await expect(imported).rejects.toThrow("帳號已切換");
    expect(actions.library).not.toHaveBeenCalled();
    await expect(prepareFullBackup("account-a")).rejects.toThrow("重新匯出");
    expect(actions.flushLibrary).not.toHaveBeenCalled();
  });
  it("waits for pending writes before preparing an export", async () => {
    let finishLibrary!: () => void;
    actions.flushLibrary.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLibrary = resolve;
        }),
    );
    let completed = false;
    const exported = prepareFullBackup("account-a").then((value) => {
      completed = true;
      return value;
    });
    await vi.waitFor(() => expect(actions.flushLibrary).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    finishLibrary();
    expect((await exported).library).toBe(library);
  });
});
