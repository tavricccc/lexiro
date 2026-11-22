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
        count < 2 &&
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ),
      retryDelay: (count, error) =>
        error instanceof ApiError && error.status === 429 ? 20_000 : Math.min(1000 * 2 ** count, 8000),
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

const fetchSet = (id: string) => api<SetContent>(`/sets/${encodeURIComponent(id)}`);

/**
 * Background set loads (starred words, practice across sets) run a few at a
 * time so they stay under the Worker's per-minute limit and never queue ahead
 * of the set on screen, which `useSet` fetches directly.
 */
const BACKGROUND_LIMIT = 3;
let backgroundRunning = 0;
const backgroundWaiting: (() => void)[] = [];
async function inBackground<T>(task: () => Promise<T>): Promise<T> {
  if (backgroundRunning >= BACKGROUND_LIMIT) {
    await new Promise<void>((resolve) => backgroundWaiting.push(resolve));
  }
  backgroundRunning++;
  try {
    return await task();
  } finally {
    backgroundRunning--;
    backgroundWaiting.shift()?.();
  }
}
const fetchSetInBackground = (id: string) => inBackground(() => fetchSet(id));

export const useSet = (id: string) =>
  useQuery({
    queryKey: keys.set(id),
    queryFn: () => fetchSet(id),
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
        queryFn: () => fetchSetInBackground(id),
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
    // Cached content stays until `syncLibrary` sees the set change, so opening
    // a tab does not refetch every set.
    queries: sets.map((set) => ({
      queryKey: keys.set(set.id),
      queryFn: () => fetchSetInBackground(set.id),
      staleTime: Infinity,
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
 * Brings the cache up to date with the Worker without refetching every set:
 * the library index, learning and prefs are refetched, and only the sets whose
 * `updatedAt` moved (or that disappeared) are refetched. The rest are marked
 * stale, so a set refetches the next time its screen opens.
 */
export async function syncLibrary() {
  const before = queryClient.getQueryData<LibraryIndex>(keys.library);
  await queryClient.refetchQueries({ queryKey: keys.library }).catch(() => {});
  const after = queryClient.getQueryData<LibraryIndex>(keys.library);
  const stamps = new Map(after?.sets.map((set) => [set.id, set.updatedAt]));
  const changed = (id: string) => {
    const cached = queryClient.getQueryData<SetContent>(keys.set(id));
    return !cached || !stamps.has(id) || cached.set.updatedAt !== stamps.get(id);
  };
  const cachedSetIds = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["set"] })
    .map((query) => String(query.queryKey[1]));
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.learning }),
    queryClient.invalidateQueries({ queryKey: keys.prefs }),
    ...cachedSetIds.map((id) => {
      if (after && !stamps.has(id)) {
        queryClient.removeQueries({ queryKey: keys.set(id), type: "inactive" });
      }
      // Without a fresh index nothing can be compared, so mark only.
      return queryClient.invalidateQueries({
        queryKey: keys.set(id),
        refetchType: after && after !== before && changed(id) ? "active" : "none",
      });
    }),
  ]);
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
        if (cached && revision !== cached.revision) await syncLibrary();
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
    }, 2500);
  });
}

export async function stopPersistence(uid?: string) {
  unsubscribe?.();
  unsubscribe = null;
  queryClient.clear();
  if (uid) await del(cacheKey(uid)).catch(() => {});
}
