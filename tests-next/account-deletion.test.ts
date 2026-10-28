import type { User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { getStorageNamespace, setStorageNamespace } from "@/src/lib/persist";

const mocks = vi.hoisted(() => ({
  stored: new Map<string, unknown>(),
  calls: [] as string[],
  agentJson: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticate: vi.fn(),
  auth: { currentUser: null as User | null },
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => mocks.stored.get(key),
  set: async (key: string, value: unknown) => void mocks.stored.set(key, value),
  del: async (key: string) => void mocks.stored.delete(key),
  keys: async () => [...mocks.stored.keys()],
  delMany: async (keys: string[]) => {
    for (const key of keys) mocks.stored.delete(key);
  },
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  reauthenticateWithPopup: mocks.reauthenticate,
  deleteUser: mocks.deleteUser,
}));
vi.mock("@/src/lib/firebase-config", () => ({
  isFirebaseConfigured: () => false,
}));
vi.mock("@/src/lib/firebase", () => ({
  configureFirebaseAuth: async () => mocks.auth,
}));
vi.mock("@/src/lib/cloud-client", () => ({
  accountNamespace: (uid: string) => `d1-v1:${uid}`,
  getCloudClient: () => null,
}));
vi.mock("@/lib/agent-client", () => ({ agentJson: mocks.agentJson }));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({
    commit: vi.fn(),
    loadState: async () => emptyLibraryState(),
    scopeMigrationIntent: async () => null,
  }),
}));
const { useCloudStore } = await import("@/stores/cloud-store");

function user(uid: string): User {
  return {
    uid,
    getIdToken: async () => {
      mocks.calls.push(`token:${uid}`);
      return "token";
    },
  } as unknown as User;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.stored = new Map<string, unknown>([
    ["d1-v1:a:lexiro-library", "a library"],
    ["d1-v1:a:lexiro-sync-journal", "a journal"],
    ["d1-v1:ab:lexiro-library", "a different account"],
    ["d1-v1:guest:lexiro-library", "guest library"],
  ]);
  mocks.auth.currentUser = user("a");
  mocks.reauthenticate.mockImplementation(async () => {
    mocks.calls.push("reauthenticate");
  });
  mocks.agentJson.mockImplementation(async () => {
    mocks.calls.push("worker");
    return { deleted: true };
  });
  mocks.deleteUser.mockImplementation(async () => {
    mocks.calls.push("firebase");
  });
  setStorageNamespace("d1-v1:a");
  useCloudStore.setState({ ready: true, user: mocks.auth.currentUser });
});

describe("deleting an account", () => {
  it("signs in again, erases the cloud first, then the Firebase user and this device's copy", async () => {
    await useCloudStore.getState().deleteAccount();
    expect(mocks.calls).toEqual([
      "reauthenticate",
      "token:a",
      "worker",
      "firebase",
    ]);
    expect(mocks.agentJson).toHaveBeenCalledWith("/account", {
      method: "DELETE",
    });
    expect(getStorageNamespace()).toBe("d1-v1:guest");
    expect(useCloudStore.getState()).toMatchObject({
      user: null,
      status: "signed-out",
    });
    expect([...mocks.stored.keys()].sort()).toEqual([
      "d1-v1:ab:lexiro-library",
      "d1-v1:guest:lexiro-library",
    ]);
  });

  it("keeps everything when the Worker refuses", async () => {
    mocks.agentJson.mockRejectedValueOnce(new Error("refused"));
    await expect(useCloudStore.getState().deleteAccount()).rejects.toThrow(
      "refused",
    );
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(getStorageNamespace()).toBe("d1-v1:a");
    expect(mocks.stored.size).toBe(4);
  });

  it("never deletes an account other than the one that asked", async () => {
    mocks.reauthenticate.mockImplementationOnce(async () => {
      mocks.auth.currentUser = user("b");
    });
    await expect(useCloudStore.getState().deleteAccount()).rejects.toThrow(
      "請用要刪除的那個帳號重新登入。",
    );
    expect(mocks.agentJson).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.stored.size).toBe(4);
  });
});
