import type { LibraryRecordRef } from "./library-repository";
import {
  CLOUD_SYNC_PENDING_EVENT,
  SYNC_JOURNAL_STORAGE_KEY,
} from "@/constants";
import { getStorageNamespace, loadFromStorage, removeRetiredAiSettings, saveToStorage } from "./persist";

/**
 * What this device has changed and not yet pushed.
 *
 * The Library itself carries no synchronization metadata: records stay clean
 * domain values, and everything sync needs to know lives here beside them. That
 * matters most for deletions. A deleted record is simply absent from the
 * Library, which is indistinguishable from one this device has never seen, so
 * without a note saying "this was deleted here" a delete could only ever be
 * inferred — and the previous design inferred it wrong, letting the cloud copy
 * come back on the next sync.
 *
 * Every entry carries the local version at which it was marked. A push clears
 * only the version it actually sent, so an edit made while the request was in
 * flight stays queued instead of being marked as synchronized along with the
 * older value that went up.
 *
 * `dirty` and `tombstones` are mutually exclusive per record: recreating a
 * deleted record clears its tombstone, deleting a dirty record replaces it.
 */
export type SyncBlobKind = "progress" | "stats";

export interface SyncDirtyEntry extends LibraryRecordRef {
  version: number;
}

export interface SyncTombstone extends LibraryRecordRef {
  /** When this device deleted it, which is what the cloud copy is judged against. */
  deletedAt: string;
  version: number;
}

export interface SyncJournal {
  schemaVersion: 3;
  /** How far this device has read the cloud's change feed. Empty means never. */
  cursor: string;
  /**
   * Whether this device has ever completed a sync for this account. It is not
   * the same question as "is the cursor empty": a brand new account has an
   * empty feed and therefore no cursor, and reading that as "never synced"
   * would re-send the whole Library on every sync forever.
   */
  seeded: boolean;
  /** Monotonic local clock. Only ever compared against itself. */
  version: number;
  dirty: Record<string, SyncDirtyEntry>;
  tombstones: Record<string, SyncTombstone>;
  /** The version at which each blob was last touched; zero means clean. */
  blobs: Record<SyncBlobKind, number>;
}

/** What a push sent, so the right version can be cleared when it lands. */
export interface SyncClearRef {
  key: string;
  version: number;
}

const SYNC_JOURNAL_SCHEMA_VERSION = 3 as const;

export function refKey(ref: LibraryRecordRef): string {
  return `${ref.kind}:${ref.id}`;
}

function emptyJournal(): SyncJournal {
  return {
    schemaVersion: SYNC_JOURNAL_SCHEMA_VERSION,
    cursor: "",
    seeded: false,
    version: 0,
    dirty: {},
    tombstones: {},
    blobs: { progress: 0, stats: 0 },
  };
}

const journals = new Map<string, SyncJournal>();
let queue: Promise<unknown> = Promise.resolve();

function isJournal(value: unknown): value is SyncJournal {
  if (!value || typeof value !== "object") return false;
  const journal = value as Partial<SyncJournal>;
  return (
    journal.schemaVersion === SYNC_JOURNAL_SCHEMA_VERSION &&
    typeof journal.cursor === "string" &&
    typeof journal.seeded === "boolean" &&
    typeof journal.version === "number" &&
    Boolean(journal.dirty) &&
    Boolean(journal.tombstones) &&
    Boolean(journal.blobs)
  );
}

async function readJournal(): Promise<SyncJournal> {
  const namespace = getStorageNamespace();
  const cached = journals.get(namespace);
  if (cached) return cached;
  const stored = await loadFromStorage(SYNC_JOURNAL_STORAGE_KEY);
  let journal = emptyJournal();
  let migrated = !stored.value;
  try {
    if (stored.value) {
      let parsed: unknown = JSON.parse(stored.value);
      if (parsed && typeof parsed === "object" && "schemaVersion" in parsed && parsed.schemaVersion === 2) {
        const previous = parsed as Omit<SyncJournal, "schemaVersion"> & { schemaVersion: 2 };
        parsed = { ...previous, schemaVersion: 3, blobs: { progress: previous.blobs.progress, stats: previous.blobs.stats } };
        migrated = isJournal(parsed);
      }
      if (isJournal(parsed)) journal = parsed;
    }
  } catch {
    // A damaged journal costs one extra full push, never data: `seeded` goes
    // with it, and a device that has not synced sends the whole Library.
    journal = emptyJournal();
    migrated = true;
  }
  if (migrated) {
    await removeRetiredAiSettings();
    await saveToStorage(SYNC_JOURNAL_STORAGE_KEY, journal);
  }
  journals.set(namespace, journal);
  return journal;
}

/** Serializes mutations so two commits cannot lose each other's notes. */
async function update(
  mutate: (journal: SyncJournal) => boolean,
): Promise<SyncJournal> {
  const run = queue.catch(() => undefined).then(async () => {
    const journal = await readJournal();
    if (mutate(journal)) await saveToStorage(SYNC_JOURNAL_STORAGE_KEY, journal);
    return journal;
  });
  queue = run;
  return run;
}

export async function loadSyncJournal(): Promise<SyncJournal> {
  return update(() => false);
}

/** Announces local work so the cloud store can debounce a sync around it. */
export function notifySyncPending(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLOUD_SYNC_PENDING_EVENT));
}

export async function recordLocalChanges(
  changed: readonly LibraryRecordRef[],
  removed: readonly LibraryRecordRef[],
  deletedAt = new Date().toISOString(),
): Promise<void> {
  if (!changed.length && !removed.length) return;
  await update((journal) => {
    journal.version += 1;
    const version = journal.version;
    for (const ref of changed) {
      const key = refKey(ref);
      delete journal.tombstones[key];
      journal.dirty[key] = { kind: ref.kind, id: ref.id, version };
    }
    for (const ref of removed) {
      const key = refKey(ref);
      delete journal.dirty[key];
      journal.tombstones[key] = {
        kind: ref.kind,
        id: ref.id,
        deletedAt,
        version,
      };
    }
    return true;
  });
  notifySyncPending();
}

/**
 * Forgets records that a pull just wrote into the Library. They came from the
 * cloud, so pushing them back would be a round trip that changes nothing — and
 * a record dropped because a remote tombstone arrived must not become a local
 * tombstone of its own.
 */
export async function untrackChanges(
  changed: readonly LibraryRecordRef[],
  removed: readonly LibraryRecordRef[],
): Promise<void> {
  if (!changed.length && !removed.length) return;
  await update((journal) => {
    for (const ref of [...changed, ...removed]) {
      const key = refKey(ref);
      delete journal.dirty[key];
      delete journal.tombstones[key];
    }
    return true;
  });
}

export async function markBlobDirty(...kinds: SyncBlobKind[]): Promise<void> {
  await update((journal) => {
    journal.version += 1;
    for (const kind of kinds) journal.blobs[kind] = journal.version;
    return true;
  });
  notifySyncPending();
}

/** Clears a blob only if nothing has touched it since the version that was sent. */
export async function clearBlobDirty(
  entries: readonly { kind: SyncBlobKind; version: number }[],
): Promise<void> {
  if (!entries.length) return;
  await update((journal) => {
    let changed = false;
    for (const entry of entries) {
      if (journal.blobs[entry.kind] !== entry.version) continue;
      journal.blobs[entry.kind] = 0;
      changed = true;
    }
    return changed;
  });
}

/** Clears a record only if it has not been changed again since it was sent. */
export async function clearPushedRecords(
  entries: readonly SyncClearRef[],
): Promise<void> {
  if (!entries.length) return;
  await update((journal) => {
    let changed = false;
    for (const entry of entries) {
      if (journal.dirty[entry.key]?.version === entry.version) {
        delete journal.dirty[entry.key];
        changed = true;
      }
      if (journal.tombstones[entry.key]?.version === entry.version) {
        delete journal.tombstones[entry.key];
        changed = true;
      }
    }
    return changed;
  });
}

export async function setSyncCursor(cursor: string): Promise<void> {
  await update((journal) => {
    if (journal.cursor === cursor) return false;
    journal.cursor = cursor;
    return true;
  });
}

/** Marks this account as fully synchronized at least once on this device. */
export async function markSeeded(): Promise<void> {
  await update((journal) => {
    if (journal.seeded) return false;
    journal.seeded = true;
    return true;
  });
}

export function pendingCountOf(journal: SyncJournal): number {
  return (
    Object.keys(journal.dirty).length +
    Object.keys(journal.tombstones).length +
    Object.values(journal.blobs).filter((version) => version > 0).length
  );
}

/** Test seam: forgets every cached journal without touching what is on disk. */
export function resetSyncJournalCache(): void {
  journals.clear();
  queue = Promise.resolve();
}
