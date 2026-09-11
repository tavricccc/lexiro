import type {
  DocumentData,
  Firestore,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase/firestore";
import type { CloudRecord } from "./cloud-records";
import type { SyncClearRef, SyncJournal } from "./sync-journal";
import type {
  FirestoreLibraryMetaDoc,
  FirestoreRecordDoc,
  LibraryState,
} from "@/types";
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  CLOUD_RECORD_PAGE_SIZE,
  CLOUD_SCHEMA_VERSION,
  CLOUD_WRITE_BATCH_SIZE,
} from "@/constants";
import {
  allLibraryRefs,
  cloudRecordId,
  recordForRef,
  tombstoneRecord,
  validateCloudRecord,
} from "./cloud-records";
import { prepareFirestoreData } from "./firestore-data";
import { refKey } from "./sync-journal";

/**
 * Talking to the cloud, one record at a time.
 *
 * Reading is a change feed: every record carries the server's own timestamp for
 * when it was last written, and a device remembers how far it has read. A sync
 * therefore costs one query for what actually changed, not a download of the
 * whole Library — which is what made the old design slow enough to feel broken,
 * because it re-read every chunk from the server on every keystroke's worth of
 * debounce.
 *
 * Writing is a plain batched write. There is no manifest to keep consistent and
 * so no lock to take: records are independent, and the worst a concurrent write
 * can do is decide one record in favour of the other device. The lock this
 * replaces had a five minute lease, and any tab that closed mid-publish left
 * every other device wedged until it expired.
 */

export function recordsCollection(db: Firestore, uid: string) {
  return collection(db, "users", uid, "records");
}

export function cloudDocument(
  db: Firestore,
  uid: string,
  collectionName: string,
  id: string,
) {
  return doc(db, "users", uid, collectionName, id);
}

/** Per-request ceiling. Short on purpose: a retry beats a spinner that never ends. */
export const CLOUD_REQUEST_TIMEOUT_MS = 10_000;

export class SyncTimeoutError extends Error {
  readonly code = "deadline-exceeded";

  constructor(label: string, timeoutMs: number) {
    super(`${label} timeout after ${timeoutMs}ms`);
    this.name = "SyncTimeoutError";
  }
}

export async function withDeadline<T>(
  operation: Promise<T>,
  label: string,
  signal?: AbortSignal,
  timeoutMs = CLOUD_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new SyncTimeoutError(label, timeoutMs)),
      timeoutMs,
    );
    if (signal) {
      onAbort = () => reject(new SyncTimeoutError(`${label} aborted`, 0));
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    return await Promise.race([operation, guard]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}

/**
 * The change-feed cursor: where this device stopped reading.
 *
 * It names a document, not just a time. A batched write stamps every document
 * in it with the same server timestamp, so a cursor that held only a timestamp
 * would skip the rest of a batch that happened to straddle a page boundary —
 * records that would then never be read again.
 */
function serializeCursor(value: Timestamp, documentId: string): string {
  return `${value.seconds}.${String(value.nanoseconds).padStart(9, "0")}|${documentId}`;
}

function parseCursor(
  value: string,
): { time: Timestamp; documentId: string } | null {
  const [stamp, id] = value.split("|");
  if (!stamp || !id) return null;
  const [seconds, nanoseconds] = stamp.split(".");
  if (!seconds || nanoseconds === undefined) return null;
  if (!Number.isFinite(Number(seconds)) || !Number.isFinite(Number(nanoseconds)))
    return null;
  return {
    time: new Timestamp(Number(seconds), Number(nanoseconds)),
    documentId: id,
  };
}

export interface CloudRecordPage {
  /** Documents the page held, whether or not they were usable. */
  size: number;
}

function readWrittenAt(snapshot: QueryDocumentSnapshot): Timestamp | null {
  const value: unknown = snapshot.get("writtenAt");
  return value instanceof Timestamp ? value : null;
}

/**
 * Reads everything written after `cursor`, following pages until it runs out.
 *
 * Paging within one run walks by document snapshot rather than by the cursor it
 * will save, which is what keeps ties and the document below correct.
 *
 * A document this device has just written but the server has not confirmed yet
 * carries no `writtenAt`, because the server stamps it. Such a document is
 * skipped: it is this device's own work, already in the Library.
 */
export async function pullRecords(
  db: Firestore,
  uid: string,
  cursor: string,
  signal?: AbortSignal,
  onPage?: (page: CloudRecordPage) => void,
): Promise<{ records: CloudRecord[]; cursor: string }> {
  const start = cursor ? parseCursor(cursor) : null;
  const records: CloudRecord[] = [];
  let nextCursor = cursor;
  let last: QueryDocumentSnapshot | null = null;

  for (;;) {
    const position: QueryConstraint[] = last
      ? [startAfter(last)]
      : start
        ? [startAfter(start.time, start.documentId)]
        : [];
    const snapshot: QuerySnapshot<DocumentData> = await withDeadline(
      getDocs(
        query(
          recordsCollection(db, uid),
          orderBy("writtenAt"),
          orderBy(documentId()),
          ...position,
          limit(CLOUD_RECORD_PAGE_SIZE),
        ),
      ),
      "Record page download",
      signal,
    );
    for (const document of snapshot.docs) {
      const writtenAt = readWrittenAt(document);
      if (!writtenAt) continue;
      records.push(validateCloudRecord(document.data(), uid, document.id));
      nextCursor = serializeCursor(writtenAt, document.id);
    }
    onPage?.({ size: snapshot.docs.length });
    if (snapshot.docs.length < CLOUD_RECORD_PAGE_SIZE) break;
    last = snapshot.docs.at(-1) ?? null;
    if (!last) break;
  }

  return { records, cursor: nextCursor };
}

/**
 * The records this device owes the cloud: everything it changed, plus a
 * tombstone for everything it deleted.
 *
 * Until this device has completed one sync for the account it sends the whole
 * Library rather than only what the journal happens to remember. That is what
 * makes a first sign-in on a device work, and it is also how a lost or damaged
 * journal heals itself instead of quietly never syncing again.
 */
export function pendingRecords(
  state: LibraryState,
  journal: SyncJournal,
): { clear: SyncClearRef[]; records: { record: CloudRecord }[] } {
  const records: { record: CloudRecord }[] = [];
  const clear: SyncClearRef[] = [];
  const seen = new Set<string>();

  for (const [key, entry] of Object.entries(journal.dirty)) {
    seen.add(key);
    clear.push({ key, version: entry.version });
    const record = recordForRef(state, entry);
    // Gone from the Library without a tombstone: pruned as an orphan when its
    // set went. Its owner's tombstone carries the deletion, so there is nothing
    // to send and nothing to keep waiting for.
    if (record) records.push({ record });
  }
  for (const [key, tombstone] of Object.entries(journal.tombstones)) {
    seen.add(key);
    clear.push({ key, version: tombstone.version });
    records.push({ record: tombstoneRecord(tombstone) });
  }

  if (!journal.seeded)
    for (const ref of allLibraryRefs(state)) {
      if (seen.has(refKey(ref))) continue;
      const record = recordForRef(state, ref);
      if (record) records.push({ record });
    }

  return { clear, records };
}

export async function pushRecords(
  db: Firestore,
  uid: string,
  records: readonly { record: CloudRecord }[],
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (!records.length) return;
  onProgress?.(0, records.length);
  for (
    let offset = 0;
    offset < records.length;
    offset += CLOUD_WRITE_BATCH_SIZE
  ) {
    const slice = records.slice(offset, offset + CLOUD_WRITE_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const { record } of slice) {
      const id = cloudRecordId({ kind: record.type, id: record.recordKey });
      batch.set(
        cloudDocument(db, uid, "records", id),
        prepareFirestoreData({
          ownerId: uid,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          type: record.type,
          recordKey: record.recordKey,
          deleted: record.deleted,
          updatedAt: record.updatedAt,
          ...(record.payload ? { payload: record.payload } : {}),
          writtenAt: serverTimestamp(),
        } satisfies FirestoreRecordDoc),
      );
    }
    await withDeadline(
      batch.commit(),
      `Record upload ${offset / CLOUD_WRITE_BATCH_SIZE + 1}`,
      signal,
    );
    onProgress?.(Math.min(offset + slice.length, records.length), records.length);
  }
  await withDeadline(
    setDoc(
      cloudDocument(db, uid, "meta", "library"),
      prepareFirestoreData({
        ownerId: uid,
        schemaVersion: CLOUD_SCHEMA_VERSION,
        changedAt: serverTimestamp(),
      } satisfies FirestoreLibraryMetaDoc),
    ),
    "Library change marker",
    signal,
  );
}

/**
 * Watches one document so another device's push wakes this one up. One listener
 * for the whole account, rather than a live query that has to be torn down and
 * re-established every time the cursor moves.
 */
export function watchCloudChanges(
  db: Firestore,
  uid: string,
  onChange: () => void,
): () => void {
  return onSnapshot(
    cloudDocument(db, uid, "meta", "library"),
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      if (snapshot.exists()) onChange();
    },
    () => {
      // A dropped listener is not a failed sync. The next manual or scheduled
      // sync still runs, and the SDK re-establishes the stream on its own.
    },
  );
}
