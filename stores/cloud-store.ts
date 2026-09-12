"use client";

import type { SyncStatus } from "@/types";
import type { User } from "firebase/auth";
import { create } from "zustand";

import { CLOUD_SYNC_PENDING_EVENT } from "@/constants";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { applyCloudRecords } from "@/src/lib/cloud-records";
import { canonicalHash } from "@/src/lib/hash";
import { isRetryableSyncError } from "@/src/lib/cloud-sync-errors";
import {
  mergeProgress,
  mergeStats,
  readCloudBlobs,
  writeCloudAiSettings,
  writeCloudProgress,
  writeCloudStats,
} from "@/src/lib/cloud-account";
import {
  pendingRecords,
  pullRecords,
  pushRecords,
  watchCloudChanges,
} from "@/src/lib/cloud-sync";
import {
  applyRemoteAiSettings,
  getShareableAiSettings,
  loadAiSettingsState,
  reloadAiSettings,
} from "@/src/lib/ai/settings";
import { configureFirebaseAuth, getFirebaseFirestore } from "@/src/lib/firebase";
import { isFirebaseConfigured } from "@/src/lib/firebase-config";
import { setStorageNamespace } from "@/src/lib/persist";
import {
  clearBlobDirty,
  clearPushedRecords,
  loadSyncJournal,
  markSeeded,
  pendingCountOf,
  resetSyncJournalCache,
  setSyncCursor,
} from "@/src/lib/sync-journal";

/**
 * Cloud sync, from the application's side.
 *
 * Two rules decide the shape of this store, and both come from bugs the
 * previous one had.
 *
 * The account's storage namespace is chosen *before* anything is loaded. It
 * used to be set at the very end of a sync, so every page load read the guest
 * Library, compared it against the signed-in account's cloud copy, concluded
 * the local side had nothing worth keeping, and committed the cloud copy over
 * the top. Anything deleted late in a session came back on the next reload,
 * which is why deleting something could take several attempts.
 *
 * And the local Library is shown immediately, never behind the network. Sync
 * runs underneath it: a pull merges record by record, a push sends what this
 * device changed. Neither one blocks the user from working.
 */

interface CloudStore {
  configured: boolean;
  /** Local data is loaded and the workspace can be shown. Never waits on network. */
  ready: boolean;
  pending: number;
  user: User | null;
  status: SyncStatus;
  error: string;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

const SYNC_DEBOUNCE_MS = 600;
/** How long the workspace waits on auth before opening on local data anyway. */
const AUTH_WAIT_MS = 1_500;
const MAX_RETRY_ATTEMPTS = 3;

let initializationPromise: Promise<void> | null = null;
let running: Promise<void> | null = null;
/** Set when a change lands mid-sync, so the run repeats instead of being dropped. */
let rerun = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let unwatch: (() => void) | null = null;

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Loads this namespace's local data. The namespace must already be set. */
async function hydrateLocal(): Promise<void> {
  await Promise.all([
    useLibraryStore.getState().hydrate(),
    useLearningStore.getState().hydrate(),
    loadAiSettingsState(),
  ]);
}

async function enterNamespace(namespace: string): Promise<void> {
  setStorageNamespace(namespace);
  resetSyncJournalCache();
  await Promise.all([
    useLibraryStore.getState().reloadNamespace(),
    useLearningStore.getState().reloadNamespace(),
    reloadAiSettings(),
  ]);
}

export const useCloudStore = create<CloudStore>((set, get) => ({
  configured: isFirebaseConfigured(),
  ready: false,
  pending: 0,
  user: null,
  status: isFirebaseConfigured() ? "connecting" : "disabled",
  error: "",

  initialize: async () => {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      const scheduleSync = () => {
        void refreshPending(set);
        if (!get().user) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          void get().sync();
        }, SYNC_DEBOUNCE_MS);
      };
      if (typeof window !== "undefined") {
        window.addEventListener(CLOUD_SYNC_PENDING_EVENT, scheduleSync);
        window.addEventListener("online", () => {
          if (get().user) void get().sync();
        });
        window.addEventListener("offline", () => {
          if (get().user) set({ status: "offline" });
        });
      }

      if (!get().configured) {
        await hydrateLocal();
        set({ ready: true, status: "disabled" });
        return;
      }

      const runtime = await import("firebase/auth");
      const auth = await configureFirebaseAuth();
      if (!auth) {
        await hydrateLocal();
        set({ ready: true, status: "disabled" });
        return;
      }

      // Auth normally resolves from its own storage in a few milliseconds, but
      // it can also never resolve at all — a blocked request, a dead network.
      // The workspace is not held hostage to that: after a short wait the guest
      // Library opens, and signing in swaps the namespace when it arrives.
      const guestFallback = setTimeout(() => {
        if (get().ready) return;
        void hydrateLocal().then(() => set({ ready: true }));
      }, AUTH_WAIT_MS);

      runtime.onAuthStateChanged(auth, (user) => {
        clearTimeout(guestFallback);
        unwatch?.();
        unwatch = null;
        void (async () => {
          // The namespace comes first, always. Everything read before this
          // point would belong to the wrong account.
          await enterNamespace(user ? user.uid : "guest");
          await refreshPending(set);
          if (!user) {
            set({ user: null, ready: true, status: "signed-out", error: "" });
            return;
          }
          set({ user, ready: true, status: "syncing", error: "" });
          const db = getFirebaseFirestore();
          if (db)
            unwatch = watchCloudChanges(db, user.uid, () => {
              void get().sync();
            });
          await get().sync();
        })();
      });
    })();
    return initializationPromise;
  },

  signIn: async () => {
    const runtime = await import("firebase/auth");
    const auth = await configureFirebaseAuth();
    if (!auth) return;
    // `onAuthStateChanged` does the rest: namespace, reload, watch, sync.
    await runtime.signInWithPopup(auth, new runtime.GoogleAuthProvider());
  },

  signOut: async () => {
    const runtime = await import("firebase/auth");
    const auth = await configureFirebaseAuth();
    if (auth) await runtime.signOut(auth);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    unwatch?.();
    unwatch = null;
    await enterNamespace("guest");
    set({ user: null, ready: true, status: "signed-out", pending: 0, error: "" });
  },

  sync: async () => {
    if (running) {
      rerun = true;
      return running;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    const run = runSync(set, get).finally(() => {
      running = null;
      if (rerun) {
        rerun = false;
        void get().sync();
      }
    });
    running = run;
    return run;
  },
}));

type SetState = (partial: Partial<CloudStore>) => void;

async function refreshPending(set: SetState): Promise<void> {
  set({ pending: pendingCountOf(await loadSyncJournal()) });
}

async function runSync(
  set: SetState,
  get: () => CloudStore,
): Promise<void> {
  const user = get().user;
  const db = getFirebaseFirestore();
  if (!user || !db) return;
  if (!online()) {
    set({ status: "offline" });
    await refreshPending(set);
    return;
  }

  set({ status: "syncing", error: "" });
  try {
    const journal = await loadSyncJournal();
    // Captured before any request goes out: the journal is live, and an edit
    // made while a write is in flight must stay queued rather than be cleared
    // along with the older value that actually went up.
    const dirtyBlobs = { ...journal.blobs };

    // Pull first. Merging before pushing means a record this device changed is
    // compared against the cloud copy while it is still marked dirty, so the
    // newer of the two survives and the loser is simply not sent.
    const pulled = await pullRecords(db, user.uid, journal.cursor);
    if (pulled.records.length) {
      const merged = applyCloudRecords(
        useLibraryStore.getState().state,
        pulled.records,
      );
      await useLibraryStore.getState().applyRemoteState(merged);
    }
    if (pulled.cursor !== journal.cursor) await setSyncCursor(pulled.cursor);

    const blobs = await readCloudBlobs(db, user.uid);
    const learning = useLearningStore.getState();
    const progress = mergeProgress(learning.progress, blobs.progress);
    const stats = mergeStats(learning.stats, blobs.stats);

    // Writing an identical value back would still rewrite IndexedDB and wake
    // every listener on every sync, so it is only applied when it differs.
    if (
      canonicalHash({ progress, stats }) !==
      canonicalHash({ progress: learning.progress, stats: learning.stats })
    )
      await learning.importState(progress, stats, { markPending: false });

    // Push after the merge, so what goes up is the reconciled value rather than
    // the copy this device happened to be holding.
    const work = pendingRecords(useLibraryStore.getState().state, journal);
    if (work.records.length) await pushRecords(db, user.uid, work.records);

    // The AI setup is taken whole from one side or the other, so the choice is
    // the dirty flag itself: a device with unsent changes sends them, and one
    // with none takes what the account already says. Half of one setup and half
    // of another is not a setup any request could be made with.
    if (!dirtyBlobs.aiSettings && blobs.aiSettings)
      applyRemoteAiSettings(blobs.aiSettings);

    const sentBlobs = [
      { kind: "aiSettings" as const, version: dirtyBlobs.aiSettings },
      { kind: "progress" as const, version: dirtyBlobs.progress },
      { kind: "stats" as const, version: dirtyBlobs.stats },
    ];
    const blobWork: Promise<unknown>[] = [];
    if (dirtyBlobs.aiSettings || !blobs.aiSettings)
      blobWork.push(
        writeCloudAiSettings(db, user.uid, getShareableAiSettings()),
      );
    if (dirtyBlobs.progress || !blobs.progress)
      blobWork.push(writeCloudProgress(db, user.uid, progress));
    if (dirtyBlobs.stats || !blobs.stats)
      blobWork.push(writeCloudStats(db, user.uid, stats));
    await Promise.all(blobWork);
    await clearPushedRecords(work.clear);
    await clearBlobDirty(sentBlobs);
    await markSeeded();

    retryAttempt = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    await refreshPending(set);
    set({ ready: true, status: "synced", error: "" });
  } catch (reason) {
    await refreshPending(set);
    set({
      ready: true,
      status: online() ? "error" : "offline",
      error: errorMessage(reason),
    });
    // Retrying a schema or permission problem just produces the same error on a
    // timer, so only the transient kinds come back on their own. Everything
    // else waits for the user to press 同步.
    if (online() && isRetryableSyncError(reason) && retryAttempt < MAX_RETRY_ATTEMPTS) {
      retryAttempt += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(
        () => void useCloudStore.getState().sync(),
        Math.min(20_000, 1_000 * 2 ** retryAttempt),
      );
    }
  }
}
