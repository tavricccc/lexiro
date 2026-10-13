import { afterEach, expect, it, vi } from "vitest";
import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { setStorageNamespace } from "@/src/lib/persist";
import {
  applyRemotePracticeDraft,
  clearPracticeDraft,
  localPracticeDraft,
  normalizeCloudPracticeDraft,
  practiceStorageKey,
  readPracticeDraft,
  writePracticeDraft,
} from "@/src/lib/practice-storage";

const { markBlobDirty } = vi.hoisted(() => ({
  markBlobDirty: vi.fn(async () => {}),
}));
vi.mock("@/src/lib/sync-journal", () => ({ markBlobDirty }));

afterEach(() => {
  markBlobDirty.mockClear();
  localStorage.clear();
  setStorageNamespace("guest");
});
it("migrates ownerless drafts to guest without exposing them to another account", () => {
  localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, "guest draft");
  setStorageNamespace("alice");
  expect(readPracticeDraft()).toBeNull();
  localStorage.setItem(practiceStorageKey(), "alice draft");
  setStorageNamespace("bob");
  expect(readPracticeDraft()).toBeNull();
  setStorageNamespace("guest");
  expect(readPracticeDraft()).toBe("guest draft");
  expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBeNull();
});

it("queues a changed session for other devices and skips an unchanged rewrite", () => {
  setStorageNamespace("alice");
  writePracticeDraft({ index: 1 });
  writePracticeDraft({ index: 1 });
  expect(markBlobDirty).toHaveBeenCalledTimes(1);
  expect(markBlobDirty).toHaveBeenCalledWith("practice");
  expect(localPracticeDraft()).toMatchObject({ snapshot: { index: 1 } });
  clearPracticeDraft();
  clearPracticeDraft();
  expect(markBlobDirty).toHaveBeenCalledTimes(2);
  // A finished session still has something to say: that it is over.
  expect(localPracticeDraft()).toMatchObject({ snapshot: null });
  expect(localPracticeDraft()!.updatedAt).not.toBe("");
});

it("adopts another device's session without queueing it back", () => {
  setStorageNamespace("alice");
  applyRemotePracticeDraft({
    updatedAt: "2026-10-02T00:00:00.000Z",
    snapshot: { index: 3 },
  });
  expect(JSON.parse(readPracticeDraft()!)).toEqual({ index: 3 });
  expect(localPracticeDraft()).toEqual({
    updatedAt: "2026-10-02T00:00:00.000Z",
    snapshot: { index: 3 },
  });
  expect(markBlobDirty).not.toHaveBeenCalled();
});

it("ignores a cloud session that belongs to another account", () => {
  const value = {
    ownerId: "bob",
    updatedAt: "2026-10-02T00:00:00.000Z",
    snapshot: null,
  };
  expect(normalizeCloudPracticeDraft(value, "alice")).toBeNull();
  expect(normalizeCloudPracticeDraft(value, "bob")).toEqual({
    updatedAt: value.updatedAt,
    snapshot: null,
  });
});
