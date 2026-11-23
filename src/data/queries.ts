import { useEffect, useMemo } from "react";
import { QueryClient, dehydrate, hydrate, useQuery, type QueryKey } from "@tanstack/react-query";
import { get, set as store, del } from "idb-keyval";
import { compareWords, type Learning, type LibraryIndex, type Prefs, type SetContent, type SetSummary, type Word } from "@lexiro/contract";
import { api, ApiError, setRevisionListener } from "./api";
import { currentAccount } from "./auth";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 86_400_000,
      // Offline, a cached answer is shown instead of an error.
      networkMode: "offlineFirst",
      // A per-minute throttle passes; other refusals do not.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.code !== "rate_limited"),
      retryDelay: (count, error) => (error instanceof ApiError && error.code === "rate_limited" ? 20_000 : Math.min(1000 * 2 ** count, 8000)),
    },
  },
});

export const keys = {
  library: ["library"] as const,
  set: (id: string) => ["set", id] as const,
  starred: ["starred"] as const,
  learning: ["learning"] as const,
  prefs: ["prefs"] as const,
  shared: (code: string) => ["shared", code] as const,
  share: (setId: string) => ["share", setId] as const,
  connections: ["connections"] as const,
};

/**
 * Set content changes only through a revision the library index reports, and
 * every index read refetches exactly those sets, so a cached set stays fresh
 * for long; the window is a backstop, not the sync.
 */
const SET_STALE_MS = 10 * 60_000;

/** Query options for one set's content. */
export const setQuery = (id: string) => ({
  queryKey: keys.set(id),
  queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`),
  staleTime: SET_STALE_MS,
});

/** Every library index read goes through here, so the sets are always checked against it. */
const libraryQuery = { queryKey: keys.library, queryFn: () => fetchLibrary() };

export const useLibrary = () => useQuery(libraryQuery);
export const useSet = (id: string) => useQuery(setQuery(id));
export const useLearningRemote = () => useQuery({ queryKey: keys.learning, queryFn: () => api<Learning>("/learning") });
export const usePrefs = () => useQuery({ queryKey: keys.prefs, queryFn: () => api<Prefs>("/prefs") });

/** Fetches every set's content into the cache, for practice across sets. */
export async function loadSets(ids: string[]): Promise<SetContent[]> {
  return Promise.all(ids.map((id) => queryClient.fetchQuery(setQuery(id))));
}

/** Every set's starred words, A to Z, grouped by set in library order: one request. */
export function useStarredWords(order: (sets: SetSummary[]) => SetSummary[]) {
  const library = useLibrary();
  const starred = useQuery({ queryKey: keys.starred, queryFn: () => api<{ words: Word[] }>("/starred"), staleTime: SET_STALE_MS });
  const groups = useMemo(() => {
    const bySet = new Map<string, Word[]>();
    for (const word of starred.data?.words ?? []) bySet.set(word.setId, [...(bySet.get(word.setId) ?? []), word]);
    return order(library.data?.sets ?? []).flatMap((set) => {
      const words = bySet.get(set.id)?.sort((a, b) => compareWords(a.word, b.word));
      return words?.length ? [{ set, words }] : [];
    });
  }, [library.data?.sets, starred.data, order]);
  return { groups, loading: library.isPending || starred.isPending, count: groups.reduce((sum, group) => sum + group.words.length, 0) };
}

// ---- revisions: telling our own writes from everyone else's ----

/** Sets this device changed itself and already patched in the cache. */
const patched = new Set<string>();

/**
 * Called by `api` for every write the Worker answers with its revisions. When
 * the write moved the account straight on from the revision the cache knows,
 * no one else wrote in between, so the cache only takes the new number.
 */
function noteRevision(before: number, after: number): boolean {
  const cached = queryClient.getQueryData<LibraryIndex>(keys.library);
  if (cached && cached.revision === before) {
    queryClient.setQueryData<LibraryIndex>(keys.library, { ...cached, revision: after });
    return true;
  }
  scheduleSync();
  return false;
}
setRevisionListener(noteRevision);

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(delay = 0) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncLibrary(), delay);
}

/**
 * After a write: sets this device already patched take their new summary
 * instead of being downloaded again. `now` waits for the synced index (a
 * write that patched nothing); otherwise quick successive writes share one.
 */
export function afterWrite(setIds: string[], own: boolean, now = false): Promise<void> {
  if (own) for (const id of setIds) patched.add(id);
  if (now) {
    clearTimeout(syncTimer);
    return syncLibrary();
  }
  scheduleSync(800);
  return Promise.resolve();
}

/** Reads the library index again; `fetchLibrary` reconciles the sets. */
export async function syncLibrary(): Promise<void> {
  await queryClient.fetchQuery({ ...libraryQuery, staleTime: 0 }).catch(() => {});
}

/** Reads the library index, then reconciles the cached sets with it. */
async function fetchLibrary(): Promise<LibraryIndex> {
  const known = queryClient.getQueryData<LibraryIndex>(keys.library)?.revision;
  const touched = new Set(patched);
  const fresh = await api<LibraryIndex>("/library");
  for (const id of touched) patched.delete(id);
  void reconcile(fresh, known, touched);
  return fresh;
}

const sameSummary = (a: SetSummary, b: SetSummary) =>
  a.name === b.name && a.folderId === b.folderId && a.order === b.order && a.hue === b.hue && a.icon === b.icon
  && a.wordCount === b.wordCount && a.questionCount === b.questionCount;

/**
 * A set whose `updatedAt` moved is refetched if on screen and marked stale if
 * not, unless this device made that change and nobody else wrote since, when
 * it only takes its new summary. Starred words, learning and prefs refetch
 * only when something they show may have changed.
 */
async function reconcile(fresh: LibraryIndex, known: number | undefined, touched: Set<string>) {
  const quiet = known === fresh.revision;
  const summaries = new Map(fresh.sets.map((set) => [set.id, set]));
  let anyChanged = false;
  const work: Promise<unknown>[] = [];
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["set"] })) {
    const id = String(query.queryKey[1]);
    const cached = query.state.data as SetContent | undefined;
    const summary = summaries.get(id);
    if (!summary) {
      if (query.getObserversCount()) work.push(query.fetch().catch(() => {}));
      else queryClient.removeQueries({ queryKey: keys.set(id), exact: true });
      continue;
    }
    if (cached && (cached.set.updatedAt === summary.updatedAt || (quiet && touched.has(id)))) {
      if (!sameSummary(cached.set, summary) || cached.set.updatedAt !== summary.updatedAt) {
        queryClient.setQueryData(keys.set(id), { ...cached, set: summary });
      }
      continue;
    }
    anyChanged = true;
    work.push(queryClient.invalidateQueries({ queryKey: keys.set(id), exact: true, refetchType: "active" }));
  }
  const foreign = !quiet && known !== undefined;
  if (foreign || anyChanged) work.push(queryClient.invalidateQueries({ queryKey: keys.starred }));
  if (foreign) work.push(queryClient.invalidateQueries({ queryKey: keys.learning }), queryClient.invalidateQueries({ queryKey: keys.prefs }));
  await Promise.all(work);
}

/**
 * After a change too wide to patch (an import, a shared set added): the index
 * is synced and every other read is marked stale, with what is on screen
 * refetched.
 */
export async function invalidate() {
  await syncLibrary();
  await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "library" });
}

/**
 * Another device or an Agent may change the library. While the page is
 * visible and online, one small request every 30 seconds tells whether the
 * account's revision moved past the cached one; only then is the index read,
 * and only the sets it shows changed are refetched.
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
        if (!cached || revision !== cached.revision) await syncLibrary();
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

const PERSISTED = new Set(["library", "set", "starred", "learning", "prefs"]);
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
  unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" && event.type !== "removed") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (currentAccount()?.uid !== uid) return;
      const snapshot = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === "success" && PERSISTED.has(String((query.queryKey as QueryKey)[0])),
      });
      void store(cacheKey(uid), snapshot).catch(() => {});
    }, 1500);
  });
}

export async function stopPersistence(uid?: string) {
  unsubscribe?.();
  unsubscribe = null;
  queryClient.clear();
  if (uid) await del(cacheKey(uid)).catch(() => {});
}
