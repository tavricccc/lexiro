import { useEffect } from "react";
import { QueryClient, dehydrate, hydrate, useQuery, type QueryKey } from "@tanstack/react-query";
import { get, set as store, del } from "idb-keyval";
import type { Learning, LibraryIndex, Prefs, SetContent } from "@lexiro/contract";
import { api, ApiError } from "./api";
import { currentAccount } from "./auth";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 86_400_000,
      // Offline, a cached answer is shown instead of an error.
      networkMode: "offlineFirst",
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
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
};

export const useLibrary = () => useQuery({ queryKey: keys.library, queryFn: () => api<LibraryIndex>("/library") });
export const useSet = (id: string) => useQuery({ queryKey: keys.set(id), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`) });
export const useLearningRemote = () => useQuery({ queryKey: keys.learning, queryFn: () => api<Learning>("/learning") });
export const usePrefs = () => useQuery({ queryKey: keys.prefs, queryFn: () => api<Prefs>("/prefs") });

/** Fetches every set's content into the cache, for practice across sets. */
export async function loadSets(ids: string[]): Promise<SetContent[]> {
  return Promise.all(ids.map((id) => queryClient.fetchQuery({ queryKey: keys.set(id), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`), staleTime: 30_000 })));
}

/** After a write: the library index and the named sets are refetched. */
export async function invalidate(...setIds: string[]) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.library }),
    ...setIds.map((id) => queryClient.invalidateQueries({ queryKey: keys.set(id) })),
  ]);
}

/**
 * Another device or an Agent may change the library. While the page is
 * visible and online, one small request every 30 seconds tells whether the
 * account's revision moved past the cached one; only then is anything refetched.
 */
export function useRevisionWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
      const cached = queryClient.getQueryData<LibraryIndex>(keys.library);
      try {
        const { revision } = await api<{ revision: number }>("/revision");
        if (cached && revision !== cached.revision) await queryClient.invalidateQueries();
      } catch { /* the next check tries again */ }
    };
    const timer = setInterval(check, 30_000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [enabled]);
}

// ---- persistence: the cache survives a reload, so the app opens offline ----

const PERSISTED = new Set(["library", "set", "learning", "prefs"]);
const cacheKey = (uid: string) => `lexiro:cache:${uid}`;
let unsubscribe: (() => void) | null = null;

/** Restores the account's cached reads, then keeps saving them as they change. */
export async function startPersistence(uid: string) {
  unsubscribe?.();
  queryClient.clear();
  try {
    const saved = await get(cacheKey(uid));
    if (saved) hydrate(queryClient, saved);
  } catch { /* a cache that cannot be read is rebuilt from the network */ }
  let timer: ReturnType<typeof setTimeout> | undefined;
  unsubscribe = queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (currentAccount()?.uid !== uid) return;
      const snapshot = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === "success" && PERSISTED.has(String((query.queryKey as QueryKey)[0])),
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
