import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { getStorageNamespace } from "./persist";

export function practiceStorageKey(): string {
  return `${getStorageNamespace()}:${PRACTICE_SESSION_STORAGE_KEY}`;
}

/** Legacy snapshots have no owner; preserve them in the guest workspace only. */
export function readPracticeDraft(): string | null {
  const legacy = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
  if (legacy !== null) {
    const guestKey = `guest:${PRACTICE_SESSION_STORAGE_KEY}`;
    if (localStorage.getItem(guestKey) === null)
      localStorage.setItem(guestKey, legacy);
    localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
  }
  return localStorage.getItem(practiceStorageKey());
}
