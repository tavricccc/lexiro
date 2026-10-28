/**
 * The last set practiced is kept on this device only, to decide which set
 * 「今天」offers to continue with, as in the app.
 */
const KEY = "lexiro:last-practiced-set";

/** Records the set a practice run is about to start with; failures are silent. */
export function rememberPracticedSet(setId: string): void {
  try {
    window.localStorage.setItem(KEY, setId);
  } catch {
    // Storage may be unavailable; 今天 then falls back to the newest set.
  }
}

export function readLastPracticedSetId(): string | null {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}
