import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import {
  applyAnswers,
  emptyLearning,
  type AnswerBatch,
  type DailyGoal,
  type Learning,
  type LearningAnswer,
} from "@/core/contract";
import { syncStorage } from "@/platform/install";
import { api, ApiError } from "./api";
import { currentAccount } from "./auth";
import { isOnline, onReconnect } from "./network";
import { keys, queryClient, useLearningRemote } from "./queries";

const storageKey = (uid: string) => `lexiro:answers:${uid}`;
type Queued = AnswerBatch & { frozen?: boolean };

const listeners = new Set<() => void>();
let snapshot: { uid: string; batches: Queued[] } = { uid: "", batches: [] };

function read(uid: string): Queued[] {
  if (snapshot.uid === uid) return snapshot.batches;
  let batches: Queued[] = [];
  try {
    const raw = syncStorage.getItem(storageKey(uid));
    batches = raw ? JSON.parse(raw) : [];
  } catch {
    batches = [];
  }
  snapshot = { uid, batches: Array.isArray(batches) ? batches : [] };
  return snapshot.batches;
}

function write(uid: string, batches: Queued[]) {
  snapshot = { uid, batches };
  syncStorage.setItem(storageKey(uid), JSON.stringify(batches));
  for (const listener of listeners) listener();
}

export function recordAnswer(answer: LearningAnswer) {
  const uid = currentAccount()?.uid;
  if (!uid) return;
  const batches = [...read(uid)];
  const open = batches.at(-1);
  if (open && !open.frozen && open.answers.length < 500) {
    batches[batches.length - 1] = { ...open, answers: [...open.answers, answer] };
  } else {
    batches.push({ batchId: crypto.randomUUID(), answers: [answer] });
  }
  write(uid, batches);
  scheduleFlush();
}

const sending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush(delay = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => void flushAnswers(), delay);
}

/** Sends every queued batch oldest first; stops at the first transient failure. */
export async function flushAnswers(): Promise<void> {
  const uid = currentAccount()?.uid;
  if (!uid || !isOnline()) return;
  for (const batch of read(uid)) {
    if (sending.has(batch.batchId)) return;
    sending.add(batch.batchId);
    if (!batch.frozen) {
      write(
        uid,
        read(uid).map((entry) =>
          entry.batchId === batch.batchId ? { ...entry, frozen: true } : entry,
        ),
      );
    }
    try {
      await api("/learning/answers", {
        method: "POST",
        json: { batchId: batch.batchId, answers: batch.answers },
      });
      queryClient.setQueryData<Learning>(
        keys.learning,
        (cached) => cached && applyAnswers(cached, batch.answers),
      );
      write(
        uid,
        read(uid).filter((entry) => entry.batchId !== batch.batchId),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 400) {
        write(
          uid,
          read(uid).filter((entry) => entry.batchId !== batch.batchId),
        );
      } else {
        return;
      }
    } finally {
      sending.delete(batch.batchId);
    }
  }
}

export function usePendingAnswers(): number {
  const uid = currentAccount()?.uid ?? "";
  const batches = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (uid ? read(uid) : snapshot.batches),
  );
  return batches.reduce((sum, batch) => sum + batch.answers.length, 0);
}

export function useLearning(): { learning: Learning; loading: boolean } {
  const remote = useLearningRemote();
  const uid = currentAccount()?.uid ?? "";
  const batches = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (uid ? read(uid) : snapshot.batches),
  );
  const learning = useMemo(
    () =>
      applyAnswers(
        remote.data ?? emptyLearning(),
        batches.flatMap((batch) => batch.answers),
      ),
    [remote.data, batches],
  );
  return { learning, loading: remote.isPending };
}

/** Flushes queued answers immediately on launch, foreground resume, and network reconnect. */
export function useAnswerFlush(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void flushAnswers();
    const unsubNet = onReconnect(() => void flushAnswers());
    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") void flushAnswers();
    });
    return () => {
      unsubNet();
      appSub.remove();
    };
  }, [enabled]);
}

export async function setGoal(goal: DailyGoal) {
  const previous = queryClient.getQueryData<Learning>(keys.learning);
  queryClient.setQueryData<Learning>(
    keys.learning,
    (cached) => cached && { ...cached, goal },
  );
  try {
    await api("/learning/goal", { method: "PUT", json: { goal } });
  } catch (reason) {
    queryClient.setQueryData(keys.learning, previous);
    throw reason;
  }
}
