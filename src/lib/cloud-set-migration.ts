import type { Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import type { DashboardStats, LearningProgress } from "@/types";
import type { CloudRecord } from "./cloud-records";
import {
  collection,
  documentId,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  writeBatch,
} from "firebase/firestore";
import {
  CLOUD_LIBRARY_META_ID,
  CLOUD_PROGRESS_DOCUMENT_ID,
  CLOUD_RECORD_COLLECTION,
  CLOUD_RECORD_PAGE_SIZE,
  CLOUD_STATS_DOCUMENT_ID,
  CLOUD_WRITE_BATCH_SIZE,
} from "@/constants";
import { cloudProgressData, cloudStatsData } from "./cloud-account";
import {
  allLibraryRefs,
  cloudRecordId,
  migrateCloudRecords,
  recordForRef,
  validateLegacyCloudRecord,
} from "./cloud-records";
import {
  cloudDocument,
  cloudLibraryMarkerData,
  cloudRecordData,
  withDeadline,
} from "./cloud-sync";
import {
  normalizeLegacyCloudProgress,
  normalizeLegacyCloudStats,
  validateCloudEnvelope,
} from "./cloud-sync-schema";
import { createDefaultStats } from "./learning-defaults";
import { remapLearningSnapshot } from "./learning-scope-migration";
import { normalizeLibraryState } from "./share";

const LEGACY_RECORD_COLLECTION = "records";
const EMPTY_TIMESTAMP = "1970-01-01T00:00:00.000Z";

interface LegacyCloudSnapshot {
  records: CloudRecord[];
  progress: LearningProgress | null;
  stats: DashboardStats | null;
}

/** A fixed remote source: local dirty records never become the account baseline. */
export function createCloudSetMigrationPlan(source: LegacyCloudSnapshot) {
  const updatedAt = [
    EMPTY_TIMESTAMP,
    ...source.records.map((record) => record.updatedAt),
    source.progress?.updatedAt ?? "",
    source.stats?.updatedAt ?? "",
  ]
    .sort()
    .at(-1)!;
  const migration = migrateCloudRecords(source.records, updatedAt);
  const state = normalizeLibraryState(migration.state);
  const learning = remapLearningSnapshot(
    source.progress ?? { cards: {}, updatedAt },
    source.stats ?? { ...createDefaultStats(), updatedAt },
    migration.senseRemaps,
  );
  const records = new Map<string, CloudRecord>();
  for (const ref of allLibraryRefs(state)) {
    const record = recordForRef(state, ref)!;
    records.set(cloudRecordId(ref), record);
  }
  // Retain old tombstones and retire the shared ids, including records the
  // domain repair pruned. A v9 feed never contains a live unscoped copy.
  for (const record of source.records) {
    const id = cloudRecordId({ kind: record.type, id: record.recordKey });
    if (!records.has(id))
      records.set(id, { ...record, deleted: true, payload: null });
  }
  return {
    state,
    records: [...records.values()],
    progress: source.progress ? learning.progress : null,
    stats: source.stats ? learning.stats : null,
  };
}

function completedMarker(value: unknown, uid: string): void {
  validateCloudEnvelope(value, uid, "Cloud set isolation", [
    "changedAt",
    "changedBy",
  ]);
}

async function hasCompletedMigration(
  db: Firestore,
  uid: string,
): Promise<boolean> {
  const marker = await withDeadline(
    getDocFromServer(cloudDocument(db, uid, "meta", CLOUD_LIBRARY_META_ID)),
    "Set isolation marker download",
  );
  if (!marker.exists()) return false;
  completedMarker(marker.data(), uid);
  return true;
}

async function readLegacyRecords(
  db: Firestore,
  uid: string,
): Promise<CloudRecord[]> {
  const records: CloudRecord[] = [];
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    const page = await withDeadline(
      getDocsFromServer(
        query(
          collection(db, "users", uid, LEGACY_RECORD_COLLECTION),
          orderBy(documentId()),
          ...(last ? [startAfter(last)] : []),
          limit(CLOUD_RECORD_PAGE_SIZE),
        ),
      ),
      "Legacy Library download",
    );
    for (const entry of page.docs)
      records.push(validateLegacyCloudRecord(entry.data(), uid, entry.id));
    if (page.size < CLOUD_RECORD_PAGE_SIZE) return records;
    last = page.docs.at(-1);
  }
}

/** Complete before the normal v9 change feed is allowed to run. */
export async function ensureCloudSetIsolation(
  db: Firestore,
  uid: string,
  sameAccount: () => boolean = () => true,
): Promise<{ completed: boolean; migrated: boolean }> {
  const stopped = { completed: false, migrated: false };
  if (!sameAccount()) return stopped;
  if (await hasCompletedMigration(db, uid))
    return { completed: sameAccount(), migrated: false };
  const [records, progress, stats] = await Promise.all([
    readLegacyRecords(db, uid),
    withDeadline(
      getDocFromServer(cloudDocument(db, uid, "progress", "global")),
      "Legacy progress download",
    ),
    withDeadline(
      getDocFromServer(cloudDocument(db, uid, "stats", "summary")),
      "Legacy stats download",
    ),
  ]);
  if (!sameAccount()) return stopped;
  // Another device may have finished and begun removing the retired copies
  // while these pages were in flight. Its published v9 snapshot is complete.
  if (await hasCompletedMigration(db, uid))
    return { completed: sameAccount(), migrated: true };
  const plan = createCloudSetMigrationPlan({
    records,
    progress: progress.exists()
      ? normalizeLegacyCloudProgress(progress.data(), uid)
      : null,
    stats: stats.exists() ? normalizeLegacyCloudStats(stats.data(), uid) : null,
  });
  const markerRef = cloudDocument(db, uid, "meta", CLOUD_LIBRARY_META_ID);
  for (
    let offset = 0;
    offset < plan.records.length;
    offset += CLOUD_WRITE_BATCH_SIZE
  ) {
    if (!sameAccount()) return stopped;
    const slice = plan.records.slice(offset, offset + CLOUD_WRITE_BATCH_SIZE);
    const result = await withDeadline(
      runTransaction(db, async (transaction) => {
        const marker = await transaction.get(markerRef);
        if (marker.exists()) {
          completedMarker(marker.data(), uid);
          return "complete";
        }
        const refs = slice.map((record) =>
          cloudDocument(
            db,
            uid,
            CLOUD_RECORD_COLLECTION,
            cloudRecordId({ kind: record.type, id: record.recordKey }),
          ),
        );
        const existing = await Promise.all(
          refs.map((ref) => transaction.get(ref)),
        );
        if (!sameAccount()) return "stopped";
        for (const [index, record] of slice.entries())
          if (!existing[index].exists())
            transaction.set(refs[index], cloudRecordData(uid, record));
        return "continue";
      }),
      "Set-scoped records migration",
    );
    if (result === "stopped") return stopped;
    if (result === "complete")
      return { completed: sameAccount(), migrated: true };
  }
  if (!sameAccount()) return stopped;
  await withDeadline(
    runTransaction(db, async (transaction) => {
      const marker = await transaction.get(markerRef);
      if (marker.exists()) {
        completedMarker(marker.data(), uid);
        return;
      }
      if (!sameAccount()) return;
      // The account blobs and completion marker become visible together. A second
      // client cannot mistake an incomplete publication for a usable v9 account.
      if (plan.progress)
        transaction.set(
          cloudDocument(db, uid, "progress", CLOUD_PROGRESS_DOCUMENT_ID),
          cloudProgressData(uid, plan.progress),
        );
      if (plan.stats)
        transaction.set(
          cloudDocument(db, uid, "stats", CLOUD_STATS_DOCUMENT_ID),
          cloudStatsData(uid, plan.stats),
        );
      transaction.set(markerRef, cloudLibraryMarkerData(uid));
    }),
    "Set isolation publication",
  );
  return { completed: sameAccount(), migrated: true };
}

/** Retired copies are cleanup only; failure leaves the published v9 data usable. */
export async function cleanupLegacyCloudCopies(
  db: Firestore,
  uid: string,
  sameAccount: () => boolean = () => true,
): Promise<boolean> {
  if (!sameAccount() || !(await hasCompletedMigration(db, uid))) return false;
  for (;;) {
    const page = await withDeadline(
      getDocsFromServer(
        query(
          collection(db, "users", uid, LEGACY_RECORD_COLLECTION),
          limit(CLOUD_WRITE_BATCH_SIZE),
        ),
      ),
      "Retired Library cleanup download",
    );
    if (!sameAccount()) return false;
    if (page.empty) break;
    const batch = writeBatch(db);
    for (const entry of page.docs) batch.delete(entry.ref);
    await withDeadline(batch.commit(), "Retired Library cleanup");
  }
  if (!sameAccount()) return false;
  const batch = writeBatch(db);
  batch.delete(cloudDocument(db, uid, "progress", "global"));
  batch.delete(cloudDocument(db, uid, "stats", "summary"));
  batch.delete(cloudDocument(db, uid, "meta", "library"));
  await withDeadline(batch.commit(), "Retired account documents cleanup");
  return true;
}
