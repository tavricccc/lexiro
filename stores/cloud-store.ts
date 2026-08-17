"use client";

import type { DashboardStats, LearningProgress, SyncStatus } from "@/types";
import type { User } from "firebase/auth";
import { create } from "zustand";
import { t } from "@/lib/i18n";
import { CLOUD_SYNC_PENDING_EVENT } from "@/constants";

import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { canonicalHash } from "@/src/lib/hash";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { cloudDocument, readCloudLibraryV5, writeCloudLearningState, writeCloudLibraryChunksV5 } from "@/src/lib/cloud-sync-remote";
import { normalizeCloudProgress, normalizeCloudStats } from "@/src/lib/cloud-sync-schema";
import { configureFirebaseAuth, getFirebaseFirestore } from "@/src/lib/firebase";
import { isFirebaseConfigured } from "@/src/lib/firebase-config";
import { clearCloudSyncPending, hasCloudSyncPending } from "@/src/lib/sync-pending";

interface CloudStore { configured: boolean; ready: boolean; pending: boolean; user: User | null; status: SyncStatus; error: string; initialize: () => Promise<void>; signIn: () => Promise<void>; signOut: () => Promise<void>; sync: () => Promise<void> }

let initializationPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function mergeProgress(remote: LearningProgress, local: LearningProgress): LearningProgress {
  const cards = { ...remote.cards };
  for (const [id, card] of Object.entries(local.cards)) {
    const current = cards[id];
    if (!current || new Date(card.lastReview ?? 0) >= new Date(current.lastReview ?? 0)) cards[id] = card;
  }
  return { cards, updatedAt: new Date().toISOString() };
}

export const useCloudStore = create<CloudStore>((set, get) => ({
  configured: isFirebaseConfigured(), ready: false, pending: false, user: null, status: isFirebaseConfigured() ? "connecting" : "disabled", error: "",
  initialize: async () => {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      set({ pending: hasCloudSyncPending() });
      window.addEventListener(CLOUD_SYNC_PENDING_EVENT, () => set({ pending: true }));
      if (!get().configured) { set({ ready: true }); return; }
      const runtime = await import("firebase/auth"); const auth = await configureFirebaseAuth();
      if (!auth) { set({ ready: true, status: "disabled" }); return; }
      runtime.onAuthStateChanged(auth, (user) => { set({ user, ready: true, status: user ? "synced" : "signed-out" }); if (user) void get().sync(); });
      window.addEventListener("online", () => { if (get().user && hasCloudSyncPending()) void get().sync(); });
    })();
    return initializationPromise;
  },
  signIn: async () => { const runtime = await import("firebase/auth"); const auth = await configureFirebaseAuth(); if (!auth) return; const result = await runtime.signInWithPopup(auth, new runtime.GoogleAuthProvider()); set({ user: result.user, status: "synced" }); await get().sync(); },
  signOut: async () => { const runtime = await import("firebase/auth"); const auth = await configureFirebaseAuth(); if (auth) await runtime.signOut(auth); await useLibraryStore.getState().switchNamespace("guest"); await useLearningStore.getState().reloadNamespace(); set({ user: null, status: "signed-out" }); },
  sync: async () => {
    if (get().status === "syncing") return;
    const user = get().user; const db = getFirebaseFirestore(); if (!user || !db) return;
    set({ status: "syncing", error: "" });
    try {
      const remoteLibrary = await readCloudLibraryV5(db, user.uid);
      const mergedLibrary = mergeLibraryStates(remoteLibrary.library, useLibraryStore.getState().state).state;
      await useLibraryStore.getState().switchNamespace(user.uid, mergedLibrary);
      const writeLibrary = await writeCloudLibraryChunksV5(db, user.uid, mergedLibrary, remoteLibrary.hashes, remoteLibrary.revision);
      if (writeLibrary.conflicted) throw new Error(t("settings.syncConflict"));
      const firestore = await import("firebase/firestore");
      const [progressDoc, statsDoc] = await Promise.all([firestore.getDocFromServer(cloudDocument(db, user.uid, "progress", "global")), firestore.getDocFromServer(cloudDocument(db, user.uid, "stats", "summary"))]);
      const localLearning = useLearningStore.getState();
      const remoteProgress = progressDoc.exists() ? normalizeCloudProgress(progressDoc.data(), user.uid) : { cards: {}, updatedAt: "" };
      const remoteStats = statsDoc.exists() ? normalizeCloudStats(statsDoc.data(), user.uid) : localLearning.stats;
      const progress = mergeProgress(remoteProgress, localLearning.progress);
      const stats: DashboardStats = new Date(remoteStats.updatedAt) > new Date(localLearning.stats.updatedAt) ? remoteStats : localLearning.stats;
      await useLearningStore.getState().importState(progress, stats);
      await writeCloudLearningState(db, user.uid, progress, stats, { progress: progressDoc.exists() ? canonicalHash(remoteProgress) : "", stats: statsDoc.exists() ? canonicalHash(remoteStats) : "" });
      clearCloudSyncPending(); retryAttempt = 0; if (retryTimer) clearTimeout(retryTimer); retryTimer = null; set({ status: "synced", pending: false });
    } catch (reason) {
      set({ status: navigator.onLine ? "error" : "offline", error: reason instanceof Error ? reason.message : String(reason) });
      if (navigator.onLine && hasCloudSyncPending()) { retryAttempt += 1; if (retryTimer) clearTimeout(retryTimer); retryTimer = setTimeout(() => void get().sync(), Math.min(30_000, 500 * 2 ** Math.min(retryAttempt, 6))); }
    }
  },
}));
