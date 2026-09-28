import { afterEach, expect, it } from "vitest";
import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { setStorageNamespace } from "@/src/lib/persist";
import {
  practiceStorageKey,
  readPracticeDraft,
} from "@/src/lib/practice-storage";

afterEach(() => {
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
