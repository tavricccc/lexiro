import type { Firestore } from "firebase/firestore";
import type { CardProgress, LibraryState } from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
  commits: [] as Array<Array<[string, Record<string, unknown>]>>,
  transactions: 0,
  failTransaction: 0,
  failCleanup: false,
  beforeTransaction: null as (() => void) | null,
}));

vi.mock("firebase/firestore", async (original) => {
  const actual = await original<typeof import("firebase/firestore")>();
  type Ref = { path: string };
  const snapshot = (ref: Ref) => ({
    ref,
    id: ref.path.split("/").at(-1)!,
    exists: () => server.documents.has(ref.path),
    data: () => server.documents.get(ref.path),
  });
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
    collection: (_db: unknown, ...parts: string[]) => ({
      path: parts.join("/"),
    }),
    documentId: () => "documentId",
    orderBy: () => ({}),
    startAfter: (entry: { ref: Ref }) => ({ after: entry.ref.path }),
    limit: (take: number) => ({ take }),
    query: (ref: Ref, ...constraints: object[]) =>
      Object.assign({}, ref, ...constraints),
    getDocFromServer: async (ref: Ref) => {
      server.reads.push(ref.path);
      return snapshot(ref);
    },
    getDocsFromServer: async ({
      path,
      after = "",
      take,
    }: Ref & { after?: string; take: number }) => {
      server.reads.push(path);
      const docs = [...server.documents.keys()]
        .filter((key) => key.startsWith(`${path}/`) && key > after)
        .sort()
        .slice(0, take)
        .map((key) => snapshot({ path: key }));
      return { docs, size: docs.length, empty: !docs.length };
    },
    runTransaction: async (
      _db: unknown,
      work: (transaction: unknown) => Promise<unknown>,
    ) => {
      server.transactions += 1;
      server.beforeTransaction?.();
      const writes: Array<[string, Record<string, unknown>]> = [];
      const result = await work({
        get: async (ref: Ref) => snapshot(ref),
        set: (ref: Ref, value: Record<string, unknown>) =>
          writes.push([ref.path, value]),
      });
      if (server.transactions === server.failTransaction)
        throw new Error("interrupted migration");
      for (const [path, value] of writes) server.documents.set(path, value);
      server.commits.push(writes);
      return result;
    },
    writeBatch: () => {
      const removed: string[] = [];
      return {
        delete: (ref: Ref) => removed.push(ref.path),
        commit: async () => {
          if (server.failCleanup) throw new Error("cleanup unavailable");
          for (const path of removed) server.documents.delete(path);
        },
      };
    },
  };
});

import {
  CLOUD_LIBRARY_META_ID,
  CLOUD_RECORD_COLLECTION,
  CLOUD_WRITE_BATCH_SIZE,
} from "@/constants";
import {
  allLibraryRefs,
  cloudRecordId,
  recordForRef,
  validateCloudRecord,
} from "@/src/lib/cloud-records";
import {
  cleanupLegacyCloudCopies,
  createCloudSetMigrationPlan,
  ensureCloudSetIsolation,
} from "@/src/lib/cloud-set-migration";
import { cloudLibraryMarkerData, cloudRecordData } from "@/src/lib/cloud-sync";
import { cloudProgressData, cloudStatsData } from "@/src/lib/cloud-account";
import {
  buildSenseId,
  buildSetWordKey,
  canonicalizeQuestion,
  normalizeWordKey,
} from "@/src/lib/library";
import { createUncategorizedFolder } from "@/src/lib/folders";
import { createDefaultStats } from "@/src/lib/learning-defaults";

const UID = "migration-account";
const TIME = "2026-10-09T00:00:00.000Z";
const db = {} as Firestore;
const path = (collection: string, id?: string) =>
  `users/${UID}/${collection}${id ? `/${id}` : ""}`;
const markerPath = path("meta", CLOUD_LIBRARY_META_ID);

function legacySource() {
  const wordKey = normalizeWordKey("adapt");
  const senseId = buildSenseId(wordKey, "v.", "適應");
  const library: LibraryState = {
    version: 1,
    words: {
      [wordKey]: {
        wordKey,
        word: "Adapt",
        updatedAt: TIME,
        senses: [
          {
            id: senseId,
            pos: "v.",
            meaningZh: "適應",
            examples: ["We adapt."],
            supplementary: false,
          },
        ],
      },
    },
    sets: ["first", "second"].map((id) => ({
      id,
      setName: id,
      folderId: "__uncategorized__",
      createdAt: TIME,
      updatedAt: TIME,
    })),
    memberships: Object.fromEntries(
      ["first", "second"].map((id) => [id, [{ wordKey, senseIds: [senseId] }]]),
    ),
    folders: [
      { ...createUncategorizedFolder(), createdAt: TIME, updatedAt: TIME },
    ],
    questions: [
      canonicalizeQuestion({
        kind: "multipleChoice",
        questionStyle: "vocabulary",
        id: "shared-question",
        fingerprint: "",
        wordKey,
        senseId,
        difficulty: 1,
        prompt: "We must _____ to the new rules.",
        options: ["adapt", "adapted", "adapting", "adapts"],
        answerIndex: 0,
        createdAt: TIME,
        updatedAt: TIME,
      }),
    ],
    updatedAt: TIME,
  };
  const card: CardProgress = {
    due: TIME,
    stability: 8,
    difficulty: 3,
    elapsedDays: 2,
    scheduledDays: 8,
    learningSteps: 0,
    reps: 4,
    lapses: 1,
    state: 2,
    lastReview: TIME,
    reviewCount: 4,
    correctCount: 3,
  };
  return {
    records: allLibraryRefs(library).map((ref) => recordForRef(library, ref)!),
    progress: { cards: { [senseId]: card }, updatedAt: TIME },
    stats: {
      ...createDefaultStats(),
      totalQuestionReviews: 3,
      correctQuestionReviews: 2,
      updatedAt: TIME,
      dailyHistory: {
        "2026-10-09": {
          date: "2026-10-09",
          memoryAgain: 0,
          memoryGood: 1,
          questionTotal: 3,
        },
      },
      questionStatsBySense: {
        [senseId]: { "vocabulary:1": { total: 3, correct: 2, retry: 1 } },
      },
    },
  };
}

function seedLegacy(source: ReturnType<typeof legacySource>) {
  for (const record of source.records)
    server.documents.set(
      path(
        "records",
        cloudRecordId({ kind: record.type, id: record.recordKey }),
      ),
      {
        ownerId: UID,
        schemaVersion: 8,
        ...record,
      },
    );
  server.documents.set(path("progress", "global"), {
    ownerId: UID,
    schemaVersion: 8,
    ...source.progress,
  });
  server.documents.set(path("stats", "summary"), {
    ownerId: UID,
    schemaVersion: 8,
    ...source.stats,
  });
}

beforeEach(() => {
  server.documents.clear();
  server.reads = [];
  server.commits = [];
  server.transactions = 0;
  server.failTransaction = 0;
  server.failCleanup = false;
  server.beforeTransaction = null;
});

describe("one-way set isolation in the cloud", () => {
  it("copies each visible source and its learning history while preserving aggregate activity and deleted records", () => {
    const source = legacySource();
    source.records.push({
      type: "question",
      recordKey: "already-deleted",
      deleted: true,
      updatedAt: TIME,
      payload: null,
    });
    const before = JSON.stringify(source);
    const plan = createCloudSetMigrationPlan(source);
    expect(plan.state.version).toBe(2);
    expect(Object.keys(plan.state.words).sort()).toEqual(
      [
        buildSetWordKey("first", "adapt"),
        buildSetWordKey("second", "adapt"),
      ].sort(),
    );
    expect(plan.state.questions).toHaveLength(2);
    expect(
      new Set(plan.state.questions.map((question) => question.id)).size,
    ).toBe(2);
    const senseIds = Object.values(plan.state.words).flatMap((word) =>
      word.senses.map((sense) => sense.id),
    );
    expect(Object.keys(plan.progress!.cards).sort()).toEqual(
      [...senseIds].sort(),
    );
    for (const senseId of senseIds)
      expect(plan.progress!.cards[senseId]).toEqual(
        Object.values(source.progress.cards)[0],
      );
    expect(Object.keys(plan.stats!.questionStatsBySense).sort()).toEqual(
      [...senseIds].sort(),
    );
    expect(plan.stats!.totalQuestionReviews).toBe(3);
    expect(plan.stats!.dailyHistory).toEqual(source.stats.dailyHistory);
    expect(
      plan.records.find((record) => record.recordKey === "already-deleted")
        ?.deleted,
    ).toBe(true);
    expect(
      plan.records.find((record) => record.recordKey === "adapt")?.deleted,
    ).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
    const oldRecord = source.records[0];
    expect(() =>
      validateCloudRecord(
        { ...oldRecord, ownerId: UID, schemaVersion: 8 },
        UID,
        cloudRecordId({ kind: oldRecord.type, id: oldRecord.recordKey }),
      ),
    ).toThrow(/schema/u);
  });

  it("resumes a multi-batch interruption from the intact v8 source and publishes both account blobs with the final marker", async () => {
    const source = legacySource();
    source.records.push(
      ...Array.from({ length: CLOUD_WRITE_BATCH_SIZE }, (_, index) => ({
        type: "question" as const,
        recordKey: `removed-${index}`,
        deleted: true,
        updatedAt: TIME,
        payload: null,
      })),
    );
    seedLegacy(source);
    const legacyBefore = [...server.documents];
    server.failTransaction = 2;
    await expect(ensureCloudSetIsolation(db, UID)).rejects.toThrow(
      "interrupted migration",
    );
    expect(server.documents.has(markerPath)).toBe(false);
    expect(server.documents.has(path("progress", "global-v9"))).toBe(false);
    expect(server.documents.has(path("stats", "summary-v9"))).toBe(false);
    expect(server.commits[0]).toHaveLength(CLOUD_WRITE_BATCH_SIZE);
    const firstBatch = new Map(server.commits[0]);
    server.failTransaction = 0;
    expect(await ensureCloudSetIsolation(db, UID)).toEqual({
      completed: true,
      migrated: true,
    });
    for (const [key, value] of firstBatch)
      expect(server.documents.get(key)).toBe(value);
    for (const [key, value] of legacyBefore)
      expect(server.documents.get(key)).toBe(value);
    expect(
      server.commits
        .at(-1)!
        .map(([key]) => key)
        .sort(),
    ).toEqual(
      [
        markerPath,
        path("progress", "global-v9"),
        path("stats", "summary-v9"),
      ].sort(),
    );
    const migrated = [...server.documents].filter(([key]) =>
      key.startsWith(`${path(CLOUD_RECORD_COLLECTION)}/`),
    );
    expect(migrated.length).toBe(
      createCloudSetMigrationPlan(source).records.length,
    );
    expect(migrated.every(([, value]) => value.schemaVersion === 9)).toBe(true);
  });

  it("stops a slower migration after another client publishes and never reads v8 on later v9 syncs", async () => {
    const source = legacySource();
    seedLegacy(source);
    const plan = createCloudSetMigrationPlan(source);
    server.beforeTransaction = () => {
      for (const record of plan.records)
        server.documents.set(
          path(
            CLOUD_RECORD_COLLECTION,
            cloudRecordId({ kind: record.type, id: record.recordKey }),
          ),
          cloudRecordData(UID, record),
        );
      server.documents.set(
        path("progress", "global-v9"),
        cloudProgressData(UID, plan.progress!),
      );
      server.documents.set(
        path("stats", "summary-v9"),
        cloudStatsData(UID, plan.stats!),
      );
      server.documents.set(markerPath, cloudLibraryMarkerData(UID));
      const changedSet = server.documents.get(
        path(
          CLOUD_RECORD_COLLECTION,
          cloudRecordId({ kind: "set", id: "first" }),
        ),
      )!;
      changedSet.payload = {
        ...(changedSet.payload as object),
        setName: "newer edit",
      };
      server.beforeTransaction = null;
    };
    await ensureCloudSetIsolation(db, UID);
    const changedSet = server.documents.get(
      path(
        CLOUD_RECORD_COLLECTION,
        cloudRecordId({ kind: "set", id: "first" }),
      ),
    )!;
    expect(changedSet.payload).toMatchObject({ setName: "newer edit" });
    expect(server.commits.flat()).toHaveLength(0);
    server.reads = [];
    expect(await ensureCloudSetIsolation(db, UID)).toEqual({
      completed: true,
      migrated: false,
    });
    expect(server.reads).toEqual([markerPath]);
  });

  it("keeps v9 usable when retired-copy cleanup fails and can finish cleanup on a later retry", async () => {
    seedLegacy(legacySource());
    expect(await cleanupLegacyCloudCopies(db, UID)).toBe(false);
    await ensureCloudSetIsolation(db, UID);
    const published = server.documents.get(markerPath);
    server.failCleanup = true;
    await expect(cleanupLegacyCloudCopies(db, UID)).rejects.toThrow(
      "cleanup unavailable",
    );
    expect(server.documents.get(markerPath)).toBe(published);
    expect(await ensureCloudSetIsolation(db, UID)).toEqual({
      completed: true,
      migrated: false,
    });
    server.failCleanup = false;
    expect(await cleanupLegacyCloudCopies(db, UID)).toBe(true);
    expect(
      [...server.documents.keys()].some((key) =>
        key.startsWith(`${path("records")}/`),
      ),
    ).toBe(false);
    expect(server.documents.has(path("progress", "global"))).toBe(false);
    expect(server.documents.get(markerPath)).toBe(published);
  });
});
