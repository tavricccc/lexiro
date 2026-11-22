import type { Round } from "@/core/domain/round";
import { syncStorage } from "@/platform/install";
import { currentAccount } from "./auth";

const key = () => `lexiro:round:${currentAccount()?.uid ?? ""}`;

export function loadRound(): Round | null {
  try {
    const raw = syncStorage.getItem(key());
    const round = raw ? (JSON.parse(raw) as Round | null) : null;
    return round && Array.isArray(round.items) && round.items.length ? round : null;
  } catch {
    return null;
  }
}

export function saveRound(round: Round): void {
  syncStorage.setItem(key(), JSON.stringify(round));
}

export function clearRound(): void {
  syncStorage.removeItem(key());
}
