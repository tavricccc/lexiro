"use client";

import type { LibraryQuestion, LibrarySet, LibraryState, SetMembership, VocabFolder, WordEntry } from "@/types";
import { create } from "zustand";

import { createUncategorizedFolder, UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { buildSenseId, canonicalizeQuestion, normalizePartOfSpeech, normalizeWordKey } from "@/src/lib/library";
import { getLibraryRepository, resetLibraryRepositoryCache } from "@/src/lib/library-repository";
import { setStorageNamespace } from "@/src/lib/persist";
import { questionBelongsToAnyMemberships } from "@/src/lib/question-ownership";

export interface WordDraftInput {
  word: string;
  pos: string;
  meaningZh: string;
  examples: string[];
}
export interface SenseRemap { oldWordKey: string; oldSenseId: string; newWordKey: string; newSenseId: string }

interface LibraryStore {
  state: LibraryState;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  hydrate: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<VocabFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, parentId?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  saveSet: (input: { id?: string; setName: string; folderId?: string; words: WordDraftInput[]; remaps?: SenseRemap[] }) => Promise<LibrarySet>;
  deleteSet: (id: string) => Promise<void>;
  saveQuestion: (question: LibraryQuestion) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  importState: (state: LibraryState) => Promise<void>;
  switchNamespace: (namespace: string, seed?: LibraryState) => Promise<void>;
}

const now = () => new Date().toISOString();

function emptyState(): LibraryState {
  return { version: 1, words: {}, sets: [], memberships: {}, folders: [createUncategorizedFolder()], questions: [], updatedAt: now() };
}

async function commit(state: LibraryState) {
  await getLibraryRepository().commitRecords(state);
  if (typeof localStorage !== "undefined") { localStorage.setItem("lexiro-sync-pending-v2", "1"); window.dispatchEvent(new Event("lexiro:sync-pending")); }
}

function folderDescendants(folders: VocabFolder[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function pruneWordsToMemberships(words: Record<string, WordEntry>, memberships: Record<string, SetMembership[]>): Record<string, WordEntry> {
  const usedByWord = new Map<string, Set<string>>();
  for (const membership of Object.values(memberships).flat()) {
    const ids = usedByWord.get(membership.wordKey) ?? new Set<string>();
    membership.senseIds.forEach((senseId) => ids.add(senseId));
    usedByWord.set(membership.wordKey, ids);
  }
  return Object.fromEntries(Object.entries(words).flatMap(([wordKey, word]) => {
    const ids = usedByWord.get(wordKey);
    if (!ids) return [];
    const senses = word.senses.filter((sense) => ids.has(sense.id));
    return senses.length ? [[wordKey, { ...word, senses }]] : [];
  })) as Record<string, WordEntry>;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  state: emptyState(),
  status: "idle",
  error: null,

  hydrate: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const state = await getLibraryRepository().loadState();
      set({ state, status: "ready" });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },

  createFolder: async (name, parentId) => {
    const timestamp = now();
    const normalizedName = name.trim().toLocaleLowerCase();
    if (!normalizedName || get().state.folders.some((folder) => folder.parentId === parentId && folder.name.trim().toLocaleLowerCase() === normalizedName)) throw new Error("folder-name-conflict");
    const folder: VocabFolder = { id: crypto.randomUUID(), name: name.trim(), ...(parentId ? { parentId } : {}), order: get().state.folders.length, createdAt: timestamp, updatedAt: timestamp };
    const state = { ...get().state, folders: [...get().state.folders, folder], updatedAt: timestamp };
    await commit(state);
    set({ state });
    return folder;
  },

  renameFolder: async (id, name) => {
    const timestamp = now();
    const current = get().state.folders.find((folder) => folder.id === id);
    if (!current) return;
    const normalizedName = name.trim().toLocaleLowerCase();
    if (!normalizedName || get().state.folders.some((folder) => folder.id !== id && folder.parentId === current.parentId && folder.name.trim().toLocaleLowerCase() === normalizedName)) throw new Error("folder-name-conflict");
    const state = { ...get().state, folders: get().state.folders.map((folder) => folder.id === id ? { ...folder, name: name.trim(), updatedAt: timestamp } : folder), updatedAt: timestamp };
    await commit(state);
    set({ state });
  },

  moveFolder: async (id, parentId) => {
    const current = get().state.folders.find((folder) => folder.id === id);
    if (!current || id === UNCATEGORIZED_FOLDER_ID || id === parentId) return;
    const descendants = folderDescendants(get().state.folders, id);
    if (parentId && descendants.has(parentId)) throw new Error("folder-cycle");
    if (get().state.folders.some((folder) => folder.id !== id && folder.parentId === parentId && folder.name.trim().toLocaleLowerCase() === current.name.trim().toLocaleLowerCase())) throw new Error("folder-name-conflict");
    const timestamp = now();
    const state = { ...get().state, folders: get().state.folders.map((folder) => folder.id === id ? { ...folder, ...(parentId ? { parentId } : { parentId: undefined }), updatedAt: timestamp } : folder), updatedAt: timestamp };
    await commit(state);
    set({ state });
  },

  deleteFolder: async (id) => {
    if (id === UNCATEGORIZED_FOLDER_ID) return;
    const timestamp = now();
    const removed = folderDescendants(get().state.folders, id);
    const removedSetIds = new Set(get().state.sets.filter((entry) => removed.has(entry.folderId)).map((entry) => entry.id));
    const memberships = Object.fromEntries(Object.entries(get().state.memberships).filter(([setId]) => !removedSetIds.has(setId)));
    const words = pruneWordsToMemberships(get().state.words, memberships);
    const state = {
      ...get().state,
      folders: get().state.folders.filter((folder) => !removed.has(folder.id)),
      sets: get().state.sets.filter((entry) => !removedSetIds.has(entry.id)),
      memberships,
      words,
      questions: get().state.questions.filter((question) => questionBelongsToAnyMemberships(question, Object.values(memberships))),
      updatedAt: timestamp,
    };
    await commit(state);
    set({ state });
    const { useLearningStore } = await import("@/stores/learning-store");
    await useLearningStore.getState().pruneToSenseIds(new Set(Object.values(words).flatMap((word) => word.senses.map((sense) => sense.id))));
  },

  saveSet: async ({ id, setName, folderId, words: drafts, remaps = [] }) => {
    const timestamp = now();
    const setId = id ?? crypto.randomUUID();
    const previous = get().state.sets.find((entry) => entry.id === setId);
    const librarySet: LibrarySet = { id: setId, setName: setName.trim(), folderId: folderId || UNCATEGORIZED_FOLDER_ID, createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp };
    const words = { ...get().state.words };
    const membershipMap = new Map<string, Set<string>>();
    for (const draft of drafts) {
      const wordKey = normalizeWordKey(draft.word);
      const pos = normalizePartOfSpeech(draft.pos) || draft.pos.trim();
      const meaningZh = draft.meaningZh.trim();
      if (!wordKey || !pos || !meaningZh) continue;
      const senseId = buildSenseId(wordKey, pos, meaningZh);
      const current = words[wordKey];
      const entry: WordEntry = current ?? { wordKey, word: draft.word.trim(), senses: [], updatedAt: timestamp };
      const sense = entry.senses.find((item) => item.id === senseId);
      words[wordKey] = {
        ...entry,
        senses: sense
          ? entry.senses.map((item) => item.id === senseId ? { ...item, examples: [...new Set([...item.examples, ...draft.examples.map((value) => value.trim()).filter(Boolean)])] } : item)
          : [...entry.senses, { id: senseId, pos, meaningZh, examples: draft.examples.map((value) => value.trim()).filter(Boolean) }],
        updatedAt: timestamp,
      };
      const senses = membershipMap.get(wordKey) ?? new Set<string>();
      senses.add(senseId);
      membershipMap.set(wordKey, senses);
    }
    const memberships: SetMembership[] = [...membershipMap].map(([wordKey, senseIds]) => ({ wordKey, senseIds: [...senseIds] }));
    const remapBySense = new Map(remaps.map((entry) => [entry.oldSenseId, entry]));
    const remappedMemberships = Object.fromEntries(Object.entries(get().state.memberships).map(([membershipSetId, entries]) => {
      const grouped = new Map<string, Set<string>>();
      for (const entry of entries) {
        for (const senseId of entry.senseIds) {
          const remap = remapBySense.get(senseId);
          const targetWordKey = remap?.newWordKey ?? entry.wordKey;
          const targetSenseId = remap?.newSenseId ?? senseId;
          const targetSenses = grouped.get(targetWordKey) ?? new Set<string>();
          targetSenses.add(targetSenseId);
          grouped.set(targetWordKey, targetSenses);
        }
      }
      return [membershipSetId, [...grouped].map(([wordKey, senseIds]) => ({ wordKey, senseIds: [...senseIds] }))];
    }));
    const nextMemberships = { ...remappedMemberships, [setId]: memberships };
    const prunedWords = pruneWordsToMemberships(words, nextMemberships);
    const state: LibraryState = {
      ...get().state,
      words: prunedWords,
      sets: previous ? get().state.sets.map((entry) => entry.id === setId ? librarySet : entry) : [...get().state.sets, librarySet],
      memberships: nextMemberships,
      questions: get().state.questions.map((question) => {
        if (question.kind === "reading") return { ...question, questions: question.questions.map((child) => { const remap = remapBySense.get(child.senseId); return remap ? { ...child, wordKey: remap.newWordKey, senseId: remap.newSenseId } : child; }), wordKeys: question.wordKeys.map((wordKey) => remaps.find((entry) => entry.oldWordKey === wordKey)?.newWordKey ?? wordKey) };
        const remap = remapBySense.get(question.senseId); return remap ? { ...question, wordKey: remap.newWordKey, senseId: remap.newSenseId } : question;
      }).filter((question) => questionBelongsToAnyMemberships(question, Object.values(nextMemberships))),
      updatedAt: timestamp,
    };
    await commit(state);
    set({ state });
    return librarySet;
  },

  deleteSet: async (id) => {
    const timestamp = now();
    const memberships = { ...get().state.memberships };
    delete memberships[id];
    const words = pruneWordsToMemberships(get().state.words, memberships);
    const state = { ...get().state, sets: get().state.sets.filter((entry) => entry.id !== id), memberships, words, questions: get().state.questions.filter((question) => questionBelongsToAnyMemberships(question, Object.values(memberships))), updatedAt: timestamp };
    await commit(state);
    set({ state });
    const { useLearningStore } = await import("@/stores/learning-store");
    await useLearningStore.getState().pruneToSenseIds(new Set(Object.values(words).flatMap((word) => word.senses.map((sense) => sense.id))));
  },

  saveQuestion: async (question) => {
    const timestamp = now();
    const normalized = canonicalizeQuestion({ ...question, updatedAt: timestamp });
    const exists = get().state.questions.some((entry) => entry.id === normalized.id);
    const duplicate = get().state.questions.some((entry) => entry.id !== normalized.id && entry.fingerprint === normalized.fingerprint);
    if (duplicate) return;
    const state = { ...get().state, questions: exists ? get().state.questions.map((entry) => entry.id === normalized.id ? normalized : entry) : [...get().state.questions, normalized], updatedAt: timestamp };
    await commit(state);
    set({ state });
  },

  deleteQuestion: async (id) => {
    const state = { ...get().state, questions: get().state.questions.filter((entry) => entry.id !== id), updatedAt: now() };
    await commit(state);
    set({ state });
  },
  importState: async (state) => { await commit(state); set({ state, status: "ready" }); },
  switchNamespace: async (namespace, seed) => {
    setStorageNamespace(namespace); resetLibraryRepositoryCache();
    if (seed) { await getLibraryRepository().commitRecords(seed); set({ state: seed, status: "ready" }); return; }
    const state = await getLibraryRepository().loadState(); set({ state, status: "ready" });
  },
}));
