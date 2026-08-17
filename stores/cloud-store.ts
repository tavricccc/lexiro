"use client";

import type { DashboardStats, LearningProgress, SyncStatus } from "@/types";
import type { User } from "firebase/auth";
import { create } from "zustand";

import { CLOUD_SYNC_PENDING_EVENT, SYNC_HEAD_STORAGE_KEY } from "@/constants";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { canonicalHash } from "@/src/lib/hash";
import { getShareableAiSettings, loadAiSettingsState, saveAiSettings, waitForAiSettingsPersistence } from "@/src/lib/ai-provider";
import {
  cloudDocument,
  readCloudLibraryV5,
  writeCloudAiSettings,
  writeCloudLearningState,
  writeCloudLibraryChunksV5,
} from "@/src/lib/cloud-sync-remote";
import { normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats } from "@/src/lib/cloud-sync-schema";
import { configureFirebaseAuth, getFirebaseFirestore } from "@/src/lib/firebase";
import { isFirebaseConfigured } from "@/src/lib/firebase-config";
import { loadFromStorage, saveToStorage } from "@/src/lib/persist";
import { clearCloudSyncPending, hasCloudSyncPending } from "@/src/lib/sync-pending";

interface LocalSyncHead {
  libraryRevision: string;
  progressHash: string;
  statsHash: string;
  settingsHash: string;
}

interface CloudStore {
  configured: boolean;
  ready: boolean;
  pending: boolean;
  user: User | null;
  status: SyncStatus;
  error: string;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

let initializationPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let localChangeVersion = 0;

function hasLibraryContent(state: ReturnType<typeof useLibraryStore.getState>["state"]): boolean {
  return Object.keys(state.words).length > 0 || state.sets.length > 0 || state.questions.length > 0;
}

function hasLearningActivity(progress: LearningProgress, stats: DashboardStats): boolean {
  return Object.keys(progress.cards).length > 0
    || stats.totalMemoryReviews > 0
    || stats.totalQuestionReviews > 0
    || stats.xp > 0;
}

async function readLocalHead(): Promise<LocalSyncHead | null> {
  const stored = await loadFromStorage(SYNC_HEAD_STORAGE_KEY);
  if (!stored.value) return null;
  try {
    const value = JSON.parse(stored.value) as Partial<LocalSyncHead>;
    if (typeof value.libraryRevision !== "string" || typeof value.progressHash !== "string" || typeof value.statsHash !== "string") return null;
    return { ...value, settingsHash: typeof value.settingsHash === "string" ? value.settingsHash : "" } as LocalSyncHead;
  } catch {
    return null;
  }
}

async function saveLocalHead(head: LocalSyncHead): Promise<void> {
  await saveToStorage(SYNC_HEAD_STORAGE_KEY, head);
}

export const useCloudStore = create<CloudStore>((set, get) => ({
  configured: isFirebaseConfigured(),
  ready: false,
  pending: hasCloudSyncPending(),
  user: null,
  status: isFirebaseConfigured() ? "connecting" : "disabled",
  error: "",

  initialize: async () => {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      set({ pending: hasCloudSyncPending() });
      const scheduleSync = () => {
        localChangeVersion += 1;
        set({ pending: true });
        if (get().user) setTimeout(() => void get().sync(), 0);
      };
      window.addEventListener(CLOUD_SYNC_PENDING_EVENT, scheduleSync);
      window.addEventListener("online", () => {
        if (get().user) void get().sync();
      });
      window.addEventListener("offline", () => {
        if (get().user) set({ status: "offline" });
      });
      if (!get().configured) {
        set({ ready: true });
        return;
      }
      const runtime = await import("firebase/auth");
      const auth = await configureFirebaseAuth();
      if (!auth) {
        set({ ready: true, status: "disabled" });
        return;
      }
      runtime.onAuthStateChanged(auth, (user) => {
        set({ user, ready: true, status: user ? "connecting" : "signed-out" });
        if (user) {
          void Promise.all([
            useLibraryStore.getState().hydrate(),
            useLearningStore.getState().hydrate(),
          ]).then(() => get().sync());
        }
      });
    })();
    return initializationPromise;
  },

  signIn: async () => {
    const runtime = await import("firebase/auth");
    const auth = await configureFirebaseAuth();
    if (!auth) return;
    const result = await runtime.signInWithPopup(auth, new runtime.GoogleAuthProvider());
    set({ user: result.user, status: "connecting" });
    await Promise.all([
      useLibraryStore.getState().hydrate(),
      useLearningStore.getState().hydrate(),
    ]);
    await get().sync();
  },

  signOut: async () => {
    const runtime = await import("firebase/auth");
    const auth = await configureFirebaseAuth();
    if (auth) await runtime.signOut(auth);
    await useLibraryStore.getState().switchNamespace("guest");
    await useLearningStore.getState().reloadNamespace();
    set({ user: null, status: "signed-out", pending: false, error: "" });
  },

  sync: async () => {
    if (get().status === "syncing") return;
    const user = get().user;
    const db = getFirebaseFirestore();
    if (!user || !db) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ status: "offline" });
      return;
    }

    set({ status: "syncing", error: "" });
    const changeVersionAtStart = localChangeVersion;
    try {
      const localLibrary = useLibraryStore.getState().state;
      const localLearning = useLearningStore.getState();
      const localAiSettings = await loadAiSettingsState();
      const localHead = await readLocalHead();
      const remoteLibrary = await readCloudLibraryV5(db, user.uid);
      const firestore = await import("firebase/firestore");
      const [progressDoc, statsDoc] = await Promise.all([
        firestore.getDocFromServer(cloudDocument(db, user.uid, "progress", "global")),
        firestore.getDocFromServer(cloudDocument(db, user.uid, "stats", "summary")),
      ]);
      const settingsDoc = await firestore.getDocFromServer(cloudDocument(db, user.uid, "settings", "ai"));
      const remoteProgress = progressDoc.exists() ? normalizeCloudProgress(progressDoc.data(), user.uid) : { cards: {}, updatedAt: "" };
      const remoteStats = statsDoc.exists() ? normalizeCloudStats(statsDoc.data(), user.uid) : localLearning.stats;
      const remoteProgressHash = progressDoc.exists() ? canonicalHash(remoteProgress) : "";
      const remoteStatsHash = statsDoc.exists() ? canonicalHash(remoteStats) : "";
      const remoteAiSettings = settingsDoc.exists() ? normalizeCloudAiSettings(settingsDoc.data(), user.uid) : null;
      const remoteSettingsHash = remoteAiSettings ? canonicalHash(remoteAiSettings) : "";
      const pending = hasCloudSyncPending();

      let authoritativeLibrary = remoteLibrary.library;
      let libraryRevision = remoteLibrary.revision;
      const canPublishLocalLibrary = pending
        && hasLibraryContent(localLibrary)
        && (!remoteLibrary.revision || localHead?.libraryRevision === remoteLibrary.revision);
      if (!remoteLibrary.revision || canPublishLocalLibrary) {
        const published = await writeCloudLibraryChunksV5(db, user.uid, localLibrary, remoteLibrary.hashes, remoteLibrary.revision);
        if (!published.conflicted) {
          authoritativeLibrary = localLibrary;
          libraryRevision = published.revision;
        }
      }

      const canPublishLocalProgress = pending && (!progressDoc.exists() || localHead?.progressHash === remoteProgressHash);
      const canPublishLocalStats = pending && (!statsDoc.exists() || localHead?.statsHash === remoteStatsHash);
      let authoritativeProgress = remoteProgress;
      let authoritativeStats = remoteStats;
      const shouldBootstrapLearning = (!progressDoc.exists() || !statsDoc.exists()) && hasLearningActivity(localLearning.progress, localLearning.stats);
      if (canPublishLocalProgress || canPublishLocalStats || shouldBootstrapLearning) {
        const published = await writeCloudLearningState(
          db,
          user.uid,
          canPublishLocalProgress || (!progressDoc.exists() && shouldBootstrapLearning) ? localLearning.progress : remoteProgress,
          canPublishLocalStats || (!statsDoc.exists() && shouldBootstrapLearning) ? localLearning.stats : remoteStats,
          { progress: remoteProgressHash, stats: remoteStatsHash },
        );
        if (published.progress.written && published.stats.written) {
          authoritativeProgress = canPublishLocalProgress || (!progressDoc.exists() && shouldBootstrapLearning) ? localLearning.progress : remoteProgress;
          authoritativeStats = canPublishLocalStats || (!statsDoc.exists() && shouldBootstrapLearning) ? localLearning.stats : remoteStats;
        }
      }

      const localShareableAiSettings = getShareableAiSettings(localAiSettings);
      const canPublishLocalSettings = pending && (!settingsDoc.exists() || localHead?.settingsHash === remoteSettingsHash);
      let authoritativeAiSettings = remoteAiSettings ?? localShareableAiSettings;
      if (canPublishLocalSettings || (!settingsDoc.exists() && pending)) {
        const published = await writeCloudAiSettings(db, user.uid, localAiSettings, remoteSettingsHash);
        if (published.result.written) authoritativeAiSettings = localShareableAiSettings;
      }

      await useLibraryStore.getState().switchNamespace(user.uid, authoritativeLibrary);
      await useLearningStore.getState().importState(authoritativeProgress, authoritativeStats, { markPending: false });
      saveAiSettings({ ...authoritativeAiSettings, apiKey: localAiSettings.apiKey }, { markPending: false });
      await waitForAiSettingsPersistence();
      await saveLocalHead({
        libraryRevision,
        progressHash: canonicalHash(authoritativeProgress),
        statsHash: canonicalHash(authoritativeStats),
        settingsHash: canonicalHash(authoritativeAiSettings),
      });
      const changedDuringSync = localChangeVersion !== changeVersionAtStart;
      if (!changedDuringSync) clearCloudSyncPending();
      retryAttempt = 0;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      set({ status: "synced", pending: changedDuringSync });
      if (changedDuringSync) setTimeout(() => void get().sync(), 0);
    } catch (reason) {
      set({ status: navigator.onLine ? "error" : "offline", error: reason instanceof Error ? reason.message : `${reason}` });
      if (navigator.onLine && hasCloudSyncPending()) {
        retryAttempt += 1;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void get().sync(), Math.min(30_000, 500 * 2 ** Math.min(retryAttempt, 6)));
      }
    }
  },
}));
