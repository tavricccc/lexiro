import {
  QueryClient,
  dehydrate,
  hydrate,
  useQueries,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AppState } from "react-native";

import {
  compareWords,
  type Learning,
  type LibraryIndex,
  type Prefs,
  type SetContent,
  type SetSummary,
} from "@/core/contract";
import { del, get, set as store } from "@/platform/kv";
import { api, ApiError } from "./api";
import { currentAccount } from "./auth";
import { isOnline, onReconnect } from "./network";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 86_400_000,
      networkMode: "offlineFirst",
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

export const keys = {
  library: ["library"] as const,
  set: (id: string) => ["set", id] as const,
  learning: ["learning"] as const,
  prefs: ["prefs"] as const,
  shared: (id: string) => ["shared", id] as const,
  connections: ["connections"] as const,
  activeRoom: ["rooms", "active"] as const,
};

export const useLibrary = () =>
  useQuery({ queryKey: keys.library, queryFn: () => api<LibraryIndex>("/library") });

export const useSet = (id: string) =>
  useQuery({
    queryKey: keys.set(id),
    queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });

export const useLearningRemote = () =>
  useQuery({ queryKey: keys.learning, queryFn: () => api<Learning>("/learning") });

export const usePrefs = () =>
  useQuery({ queryKey: keys.prefs, queryFn: () => api<Prefs>("/prefs") });

export function orderedSets(sets: SetSummary[]): SetSummary[] {
  return [...sets].sort(
    (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || compareWords(a.name, b.name),
  );
}

/** Fetches every set's content into the cache, for practice across sets. */
export async function loadSets(ids: string[]): Promise<SetContent[]> {
  return Promise.all(
    ids.map((id) =>
      queryClient.fetchQuery({
        queryKey: keys.set(id),
        queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`),
        staleTime: 30_000,
      }),
    ),
  );
}

/** After a write: the library index and the named sets are refetched. */
export async function invalidate(...setIds: string[]) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.library }),
    ...setIds.map((id) => queryClient.invalidateQueries({ queryKey: keys.set(id) })),
  ]);
}

/** Every set's starred words, A to Z, grouped by set in library order. */
export function useStarredWords() {
  const library = useLibrary();
  const sets = useMemo(
    () => orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0),
    [library.data?.sets],
  );
  const contents = useQueries({
    queries: sets.map((set) => ({
      queryKey: keys.set(set.id),
      queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(set.id)}`),
    })),
  });
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  const groups = useMemo(
    () =>
      contents.flatMap((query) => {
        const words =
          query.data?.words
            .filter((word) => word.starred)
            .sort((a, b) => compareWords(a.word, b.word)) ?? [];
        return query.data && words.length ? [{ set: query.data.set, words }] : [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  );
  const loading = !library.data || contents.some((query) => query.isPending);
  return {
    groups,
    loading,
    count: groups.reduce((sum, group) => sum + group.words.length, 0),
  };
}

/**
 * Watches for library edits made by another device or an AI Agent. Polls
 * `/revision` every 30s while foregrounded and online, and checks immediately on
 * foreground resume or network reconnect.
 */
export function useRevisionWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const check = async () => {
      if (stopped || AppState.currentState !== "active" || !isOnline()) return;
      const cached = queryClient.getQueryData<LibraryIndex>(keys.library);
      try {
        const { revision } = await api<{ revision: number }>("/revision");
        if (cached && revision !== cached.revision) {
          await queryClient.invalidateQueries();
        }
      } catch {
        // Next poll or foreground resume will retry.
      }
    };
    const timer = setInterval(() => void check(), 30_000);
    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") void check();
    });
    const unsubNet = onReconnect(() => void check());
    return () => {
      stopped = true;
      clearInterval(timer);
      appSub.remove();
      unsubNet();
    };
  }, [enabled]);
}

// ---- AsyncStorage persistence so the app opens offline immediately ----

const PERSISTED = new Set(["library", "set", "learning", "prefs"]);
const cacheKey = (uid: string) => `lexiro:cache:${uid}`;
let unsubscribe: (() => void) | null = null;

export async function startPersistence(uid: string) {
  unsubscribe?.();
  queryClient.clear();
  try {
    const saved = await get(cacheKey(uid));
    if (saved) hydrate(queryClient, saved);
  } catch {
    // Unreadable cache is rebuilt cleanly from network.
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  unsubscribe = queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (currentAccount()?.uid !== uid) return;
      const snapshot = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" &&
          PERSISTED.has(String((query.queryKey as QueryKey)[0])),
      });
      void store(cacheKey(uid), snapshot).catch(() => {});
    }, 1000);
  });
}

export async function stopPersistence(uid?: string) {
  unsubscribe?.();
  unsubscribe = null;
  queryClient.clear();
  if (uid) await del(cacheKey(uid)).catch(() => {});
}
