import {
  QueryClient,
  dehydrate,
  hydrate,
  useQuery,
  type DehydratedState,
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
  type Word,
} from "@/core/contract";
import {
  del,
  delMany,
  get,
  getMany,
  keys as storedKeys,
  setMany,
} from "@/platform/kv";
import { api, ApiError, setRevisionListener } from "./api";
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
          error.code !== "rate_limited"
        ),
      retryDelay: (count, error) =>
        error instanceof ApiError && error.code === "rate_limited"
          ? 20_000
          : Math.min(1000 * 2 ** count, 8000),
    },
  },
});

export const keys = {
  library: ["library"] as const,
  set: (id: string) => ["set", id] as const,
  starred: ["starred"] as const,
  learning: ["learning"] as const,
  prefs: ["prefs"] as const,
  shared: (id: string) => ["shared", id] as const,
  connections: ["connections"] as const,
  activeRoom: ["rooms", "active"] as const,
};

/**
 * Set content changes only through a revision the library index reports, and
 * `syncLibrary` refetches exactly those sets, so a cached set stays fresh for
 * long; the window is a backstop, not the sync.
 */
const SET_STALE_MS = 10 * 60_000;

const fetchSet = (id: string) =>
  api<SetContent>(`/sets/${encodeURIComponent(id)}`);

/**
 * Sets loaded for practice across sets run a few at a time so they stay under
 * the Worker's per-minute limit and never queue ahead of the set on screen.
 */
const BACKGROUND_LIMIT = 3;
let backgroundRunning = 0;
const backgroundWaiting: (() => void)[] = [];
async function inBackground<T>(task: () => Promise<T>): Promise<T> {
  while (backgroundRunning >= BACKGROUND_LIMIT) {
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

/** Query options for one set's content; `background` queues it behind the limit. */
export const setQuery = (id: string, background = false) => ({
  queryKey: keys.set(id),
  queryFn: () => (background ? inBackground(() => fetchSet(id)) : fetchSet(id)),
  staleTime: SET_STALE_MS,
});

/** Every library index read goes through here, so the sets are always checked against it. */
const libraryQuery = { queryKey: keys.library, queryFn: () => fetchLibrary() };

export const useLibrary = () => useQuery(libraryQuery);

export const useSet = (id: string) =>
  useQuery({ ...setQuery(id), enabled: Boolean(id) });

export const useLearningRemote = () =>
  useQuery({
    queryKey: keys.learning,
    queryFn: () => api<Learning>("/learning"),
  });

export const usePrefs = () =>
  useQuery({ queryKey: keys.prefs, queryFn: () => api<Prefs>("/prefs") });

export function orderedSets(sets: SetSummary[]): SetSummary[] {
  return [...sets].sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      compareWords(a.name, b.name),
  );
}

/** Fetches every set's content into the cache, for practice across sets. */
export async function loadSets(ids: string[]): Promise<SetContent[]> {
  return Promise.all(
    ids.map((id) => queryClient.fetchQuery(setQuery(id, true))),
  );
}

/** Every set's starred words, A to Z, grouped by set in library order: one request. */
export function useStarredWords() {
  const library = useLibrary();
  const starred = useQuery({
    queryKey: keys.starred,
    queryFn: () => api<{ words: Word[] }>("/starred"),
    staleTime: SET_STALE_MS,
  });
  const groups = useMemo(() => {
    const bySet = new Map<string, Word[]>();
    for (const word of starred.data?.words ?? []) {
      bySet.set(word.setId, [...(bySet.get(word.setId) ?? []), word]);
    }
    return orderedSets(library.data?.sets ?? []).flatMap((set) => {
      const words = bySet
        .get(set.id)
        ?.sort((a, b) => compareWords(a.word, b.word));
      return words?.length ? [{ set, words }] : [];
    });
  }, [library.data?.sets, starred.data]);
  return {
    groups,
    loading: library.isPending || starred.isPending,
    count: groups.reduce((sum, group) => sum + group.words.length, 0),
  };
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
    queryClient.setQueryData<LibraryIndex>(keys.library, {
      ...cached,
      revision: after,
    });
    return true;
  }
  scheduleSync();
  return false;
}
setRevisionListener(noteRevision);

/**
 * After this device changed sets it already patched in the cache: the library
 * index is refreshed soon (counts, updatedAt), and those sets take their new
 * summary instead of being downloaded again.
 */
export function afterWrite(
  setIds: string[],
  own: boolean,
  now = false,
): Promise<void> {
  if (own) for (const id of setIds) patched.add(id);
  if (now) {
    clearTimeout(syncTimer);
    return syncLibrary();
  }
  // Quick successive writes (starring down a list) share one sync.
  scheduleSync(800);
  return Promise.resolve();
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(delay = 0) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncLibrary(), delay);
}

/**
 * Brings the cache up to date with the Worker without refetching every set:
 * the library index is read again, and `fetchLibrary` reconciles the sets.
 */
export async function syncLibrary(): Promise<void> {
  await queryClient
    .fetchQuery({ ...libraryQuery, staleTime: 0 })
    .catch(() => {});
}

const sameSummary = (a: SetSummary, b: SetSummary) =>
  a.name === b.name &&
  a.folderId === b.folderId &&
  a.order === b.order &&
  a.hue === b.hue &&
  a.icon === b.icon &&
  a.wordCount === b.wordCount &&
  a.questionCount === b.questionCount;

/**
 * Reads the library index, then reconciles the cached sets with it: a set
 * whose `updatedAt` moved is refetched if on screen and marked stale if not,
 * unless this device made that change and nobody else wrote since, when it
 * only takes its new summary. Starred words, learning and prefs refetch only
 * when something they show may have changed.
 */
async function fetchLibrary(): Promise<LibraryIndex> {
  const known = queryClient.getQueryData<LibraryIndex>(keys.library)?.revision;
  const touched = new Set(patched);
  const fresh = await api<LibraryIndex>("/library");
  for (const id of touched) patched.delete(id);
  // Only this device wrote since the revision the cache knew.
  void reconcile(fresh, known, touched);
  return fresh;
}

async function reconcile(
  fresh: LibraryIndex,
  known: number | undefined,
  touched: Set<string>,
) {
  const quiet = known === fresh.revision;
  const summaries = new Map(fresh.sets.map((set) => [set.id, set]));
  let anyChanged = false;

  const work: Promise<unknown>[] = [];
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ["set"] })) {
    const id = String(query.queryKey[1]);
    const cached = query.state.data as SetContent | undefined;
    const summary = summaries.get(id);
    if (!summary) {
      if (query.getObserversCount()) work.push(query.fetch().catch(() => {}));
      else queryClient.removeQueries({ queryKey: keys.set(id), exact: true });
      continue;
    }
    if (cached && cached.set.updatedAt === summary.updatedAt) {
      if (!sameSummary(cached.set, summary)) {
        queryClient.setQueryData(keys.set(id), { ...cached, set: summary });
      }
      continue;
    }
    if (cached && quiet && touched.has(id)) {
      queryClient.setQueryData(keys.set(id), { ...cached, set: summary });
      continue;
    }
    anyChanged = true;
    work.push(
      queryClient.invalidateQueries({
        queryKey: keys.set(id),
        exact: true,
        refetchType: "active",
      }),
    );
  }
  if ((!quiet && known !== undefined) || anyChanged) {
    work.push(queryClient.invalidateQueries({ queryKey: keys.starred }));
  }
  if (!quiet && known !== undefined) {
    work.push(
      queryClient.invalidateQueries({ queryKey: keys.learning }),
      queryClient.invalidateQueries({ queryKey: keys.prefs }),
    );
  }
  await Promise.all(work);
}

/**
 * Pull to refresh, or after a change too wide to patch (an import, a shared
 * set added): the index is synced and every other read is marked stale, with
 * what is on screen refetched.
 */
export async function refreshAll() {
  await syncLibrary();
  await queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== "library",
  });
}

export const invalidate = refreshAll;

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
        if (!cached || revision !== cached.revision) await syncLibrary();
      } catch {
        // Next poll or foreground resume will retry.
      }
    };
    void check();
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

/**
 * Each query is stored under its own key and written only when its data
 * changed, so one starred word does not rewrite every set on disk.
 */
const PERSISTED = new Set(["library", "set", "learning", "prefs", "starred"]);
const entryPrefix = (uid: string) => `lexiro:q:${uid}:`;
const legacyKey = (uid: string) => `lexiro:cache:${uid}`;
type DehydratedQuery = DehydratedState["queries"][number];

let unsubscribe: (() => void) | null = null;

/**
 * Empties the cache for another account without detaching what is on
 * screen: in-flight reads are cancelled and reverted, unused queries are
 * dropped, and the rest go back to their empty state (clearing them would
 * leave mounted screens watching queries the cache no longer holds).
 */
async function resetCache() {
  await queryClient.cancelQueries();
  queryClient.removeQueries({ type: "inactive" });
  for (const query of queryClient.getQueryCache().getAll()) query.reset();
}

export async function startPersistence(uid: string) {
  unsubscribe?.();
  await resetCache();
  const prefix = entryPrefix(uid);
  const saved = new Map<string, number>();
  try {
    const names = (await storedKeys()).filter((name) =>
      name.startsWith(prefix),
    );
    let queries = (await getMany<DehydratedQuery>(names)).filter(
      (entry): entry is DehydratedQuery => Boolean(entry),
    );
    if (!queries.length) {
      const legacy = await get<DehydratedState>(legacyKey(uid));
      queries = legacy?.queries ?? [];
    }
    hydrate(queryClient, { mutations: [], queries });
    for (const query of queries)
      saved.set(query.queryHash, query.state.dataUpdatedAt);
  } catch {
    // Unreadable cache is rebuilt cleanly from network.
  }
  void del(legacyKey(uid)).catch(() => {});
  // What is on screen without a cached answer loads now, as do learning and
  // prefs (today's numbers move with the date); the library and its sets are
  // checked against the revision by the revision watch.
  void queryClient.refetchQueries({
    type: "active",
    predicate: (query) =>
      query.state.data === undefined ||
      (["learning", "prefs"].includes(String(query.queryKey[0])) &&
        query.isStale()),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    if (currentAccount()?.uid !== uid) return;
    const { queries } = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" &&
        PERSISTED.has(String(query.queryKey[0])),
    });
    const live = new Set(queries.map((query) => query.queryHash));
    const changed = queries.filter(
      (query) => saved.get(query.queryHash) !== query.state.dataUpdatedAt,
    );
    const gone = [...saved.keys()].filter((hash) => !live.has(hash));
    for (const query of changed)
      saved.set(query.queryHash, query.state.dataUpdatedAt);
    for (const hash of gone) saved.delete(hash);
    if (changed.length) {
      void setMany(
        changed.map((query) => [prefix + query.queryHash, query]),
      ).catch(() => {});
    }
    if (gone.length)
      void delMany(gone.map((hash) => prefix + hash)).catch(() => {});
  };
  unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" && event.type !== "removed") return;
    clearTimeout(timer);
    timer = setTimeout(persist, 1500);
  });
}

export async function stopPersistence(uid?: string) {
  unsubscribe?.();
  unsubscribe = null;
  await resetCache();
  if (!uid) return;
  const prefix = entryPrefix(uid);
  const names = (await storedKeys().catch(() => [])).filter((name) =>
    name.startsWith(prefix),
  );
  await Promise.all([delMany(names), del(legacyKey(uid))]).catch(() => {});
}
