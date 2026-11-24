import type { Round } from "@/domain/round";
import { currentAccount } from "./auth";

/** The round in progress, kept on this device so a reload or a crash resumes it. */
const key = () => `lexiro:round:${currentAccount()?.uid ?? ""}`;

export function loadRound(): Round | null {
  try {
    const round = JSON.parse(localStorage.getItem(key()) ?? "null") as Round | null;
    return round && Array.isArray(round.items) && round.items.length ? round : null;
  } catch {
    return null;
  }
}
export const saveRound = (round: Round) => localStorage.setItem(key(), JSON.stringify(round));
export const clearRound = () => localStorage.removeItem(key());
