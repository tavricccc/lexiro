import { useSyncExternalStore } from "react";
import type { Round } from "@/domain/round";
import { currentAccount } from "./auth";

/** The round in progress, kept on this device so a reload or a crash resumes it. */
const key = () => `lexiro:round:${currentAccount()?.uid ?? ""}`;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

const stored = () => {
  try {
    return localStorage.getItem(key());
  } catch {
    return null;
  }
};

function parse(text: string | null): Round | null {
  try {
    const round = JSON.parse(text ?? "null") as Round | null;
    return round && Array.isArray(round.items) && round.items.length ? round : null;
  } catch {
    return null;
  }
}

export const loadRound = () => parse(stored());
export function saveRound(round: Round) {
  localStorage.setItem(key(), JSON.stringify(round));
  changed();
}
export function clearRound() {
  localStorage.removeItem(key());
  changed();
}

// One parsed round per stored text, so a screen that has nothing new does not render again.
let seen: { text: string | null; round: Round | null } = { text: null, round: null };
function current() {
  const text = stored();
  if (text !== seen.text) seen = { text, round: parse(text) };
  return seen.round;
}

/** The round in progress as it stands, for screens that stay open beneath it. */
export const useSavedRound = () => useSyncExternalStore((listener) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}, current);
