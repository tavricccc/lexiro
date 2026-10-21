import {
  agentRecordId,
  agentSetRevision,
  agentFoldersRevision,
  mutateAgentFolders,
  validateAgentSnapshot,
  UNCATEGORIZED_FOLDER_ID,
  type AgentSetSnapshot,
  type AgentMutationResult,
  type AgentFolderMutation,
  type VocabFolder,
  type AgentCloudRecord,
} from "@lexiro/agent-contract";
import type {
  AgentEnv,
  AgentLibraryRepository,
  MutationReceipt,
} from "./types";
import { CloudD1Repository, type AccountHead } from "../cloud/repository";
import {
  changedSnapshotRecords,
  recordValue,
  type RecordRow,
} from "../cloud/records";
import { fingerprint, HttpError } from "../http";
import { queryLibrary, type AgentQuery } from "./query";

export class D1AgentLibrary implements AgentLibraryRepository {
  private cloud: CloudD1Repository;
  constructor(private env: AgentEnv) {
    this.cloud = new CloudD1Repository(env.CLOUD_DB);
  }
  async list(uid: string) {
    return (await this.cloud.rows(uid, "set")).map((row) => {
      const set = JSON.parse(row.payload!) as AgentSetSnapshot["set"];
      return { id: set.id, setName: set.setName, folderId: set.folderId };
    });
  }
  private async load(uid: string, setId: string) {
    const db = this.env.CLOUD_DB;
    const result = await db.batch([
      db
        .prepare(
          "SELECT revision,blob_revision,changed_by,blob_changed_by FROM cloud_accounts WHERE uid=?",
        )
        .bind(uid),
      db
        .prepare(
          "SELECT id,kind,record_key,payload,deleted,updated_at,seq FROM cloud_records WHERE uid=? AND id IN (?,?) AND deleted=0",
        )
        .bind(
          uid,
          agentRecordId("set", setId),
          agentRecordId("membership", setId),
        ),
      db
        .prepare(
          "SELECT r.* FROM cloud_memberships m CROSS JOIN cloud_records r INDEXED BY cloud_records_key WHERE m.uid=? AND m.set_id=? AND r.uid=m.uid AND r.kind='word' AND r.record_key=m.word_key AND r.deleted=0 ORDER BY r.id",
        )
        .bind(uid, setId),
      db
        .prepare(
          "SELECT r.* FROM cloud_records r INDEXED BY cloud_records_key WHERE r.uid=? AND r.kind='question' AND r.deleted=0 AND r.record_key IN (SELECT q.question_id FROM cloud_memberships m CROSS JOIN cloud_question_sources q WHERE m.uid=? AND m.set_id=? AND q.uid=m.uid AND q.word_key=m.word_key) ORDER BY r.id",
        )
        .bind(uid, uid, setId),
    ]);
    const head = (result[0].results[0] as unknown as
      AccountHead | undefined) ?? {
      revision: 0,
      blob_revision: 0,
      changed_by: "",
      blob_changed_by: "",
    };
    const rows = result[1].results as unknown as RecordRow[];
    const set = rows.find((row) => row.kind === "set");
    if (!set) return { snapshot: null, head };
    const membership = rows.find((row) => row.kind === "membership");
    if (!membership) throw new HttpError(409, "set_sync_incomplete");
    const snapshot = validateAgentSnapshot(
      {
        set: JSON.parse(set.payload!),
        memberships: JSON.parse(membership.payload!).members,
        words: (result[2].results as unknown as RecordRow[]).map((row) =>
          JSON.parse(row.payload!),
        ),
        questions: (result[3].results as unknown as RecordRow[]).map((row) =>
          JSON.parse(row.payload!),
        ),
      },
      setId,
    );
    return { snapshot, head };
  }
  async read(uid: string, setId: string) {
    return (await this.load(uid, setId)).snapshot;
  }
  async query(
    uid: string,
    query: AgentQuery,
  ): Promise<Record<string, unknown>> {
    if (query.resource !== "set")
      return queryLibrary(this.env.CLOUD_DB, uid, query);
    if (!query.setId) throw new HttpError(400, "missing_setId");
    const snapshot = await this.read(uid, query.setId);
    if (!snapshot) throw new HttpError(404, "set_not_found");
    return {
      set: snapshot.set,
      revision: agentSetRevision(snapshot),
      wordCount: snapshot.words.length,
      senseCount: snapshot.words.reduce(
        (count, word) => count + word.senses.length,
        0,
      ),
      questionCount: snapshot.questions.length,
    };
  }
  private async folderExists(uid: string, id: string) {
    if (id === UNCATEGORIZED_FOLDER_ID) return;
    const row = await this.env.CLOUD_DB.prepare(
      "SELECT id FROM cloud_records WHERE uid=? AND id=? AND kind='folder' AND deleted=0",
    )
      .bind(uid, agentRecordId("folder", id))
      .first();
    if (!row) throw new HttpError(400, "folder_not_found");
  }
  async create(uid: string, snapshot: AgentSetSnapshot) {
    const before = await this.load(uid, snapshot.set.id);
    if (before.snapshot) throw new HttpError(409, "set_exists");
    await this.folderExists(uid, snapshot.set.folderId);
    const valid = validateAgentSnapshot(snapshot, snapshot.set.id),
      id = crypto.randomUUID();
    await this.cloud.commit(
      uid,
      before.head,
      changedSnapshotRecords(null, valid),
      [],
      "agent:create",
      id,
      await fingerprint(JSON.stringify(valid)),
      { created: valid.set.id },
    );
  }
  async mutate(
    uid: string,
    setId: string,
    revision: string | undefined,
    operationId: string,
    action: unknown,
    apply: (
      snapshot: AgentSetSnapshot,
      blockedQuestionIds: string[],
    ) => AgentMutationResult,
  ) {
    const hash = await fingerprint(JSON.stringify({ setId, revision, action }));
    const previous = await this.cloud.operation<MutationReceipt>(
      uid,
      operationId,
      hash,
    );
    if (previous) return previous;
    // The account head guards every commit, so an unrelated write (app sync,
    // another Agent) can land between load and commit. Reapply on a fresh
    // load; an explicit expectedRevision is rechecked against that load.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.attempt(
          uid,
          setId,
          revision,
          operationId,
          action,
          hash,
          apply,
        );
      } catch (reason) {
        if (!(reason instanceof HttpError) || reason.code !== "account_busy")
          throw reason;
        if (attempt === 3) {
          const error = new HttpError(409, "stale_set");
          error.message =
            "Other writes to this account (app sync or another agent) kept conflicting after 3 retries; nothing was written. Resend later with the same operationId.";
          throw error;
        }
      }
    }
  }
  private async attempt(
    uid: string,
    setId: string,
    revision: string | undefined,
    operationId: string,
    action: unknown,
    hash: string,
    apply: (
      snapshot: AgentSetSnapshot,
      blockedQuestionIds: string[],
    ) => AgentMutationResult,
  ) {
    const before = await this.load(uid, setId);
    if (!before.snapshot) throw new HttpError(404, "set_not_found");
    const current = agentSetRevision(before.snapshot);
    if (revision !== undefined && current !== revision) {
      const error = new HttpError(409, "stale_set");
      error.message = `expectedRevision ${revision} is stale; the set is now at revision ${current} and nothing was written. Omit expectedRevision to apply to the latest content, or re-read and resend with the new revision.`;
      throw error;
    }
    const oldQuestions = new Set(before.snapshot.questions.map((q) => q.id));
    const requested =
      action &&
      typeof action === "object" &&
      "questions" in action &&
      Array.isArray(action.questions)
        ? action.questions.flatMap((q) =>
            q &&
            typeof q === "object" &&
            "id" in q &&
            typeof q.id === "string" &&
            !oldQuestions.has(q.id)
              ? [q.id]
              : [],
          )
        : [];
    const collisions = async (ids: string[]) => {
      if (!ids.length) return [];
      const rows = await this.env.CLOUD_DB.prepare(
        "SELECT record_key FROM cloud_records INDEXED BY cloud_records_key WHERE uid=? AND kind='question' AND record_key IN (SELECT value FROM json_each(?)) AND deleted=0",
      )
        .bind(uid, JSON.stringify(ids))
        .all<{ record_key: string }>();
      return rows.results.map((row) => row.record_key);
    };
    const blocked = await collisions(requested);
    const { snapshot: after, validation } = apply(before.snapshot, blocked);
    if (after) await this.folderExists(uid, after.set.folderId);
    const records = changedSnapshotRecords(before.snapshot, after);
    const newQuestions = records
      .filter(
        (record) =>
          record.type === "question" &&
          !record.deleted &&
          !oldQuestions.has(record.recordKey),
      )
      .map((record) => record.recordKey);
    if (
      newQuestions.some((id) => blocked.includes(id)) ||
      (await collisions(newQuestions.filter((id) => !requested.includes(id))))
        .length
    )
      throw new HttpError(403, "question_outside_scope");
    const explicit = new Set(
      action &&
        typeof action === "object" &&
        "questionIds" in action &&
        Array.isArray(action.questionIds)
        ? action.questionIds
        : [],
    );
    const kept = new Set(after?.questions.map((q) => q.id));
    const removed = after
      ? before.snapshot.questions
          .map((q) => q.id)
          .filter((id) => !kept.has(id) && !explicit.has(id))
      : [];
    const receipt: MutationReceipt = {
      operationId,
      setId,
      revision: agentSetRevision(after),
      wordCount: after?.words.length ?? 0,
      questionCount: after?.questions.length ?? 0,
      deleted: !after,
      ...(removed.length
        ? {
            removedQuestionCount: removed.length,
            removedQuestionIds: removed.slice(0, 20),
          }
        : {}),
      ...validation,
    };
    try {
      return await this.cloud.commit(
        uid,
        before.head,
        records,
        [],
        `agent:${operationId}`,
        operationId,
        hash,
        receipt,
      );
    } catch (reason) {
      if (reason instanceof HttpError && reason.code === "stale_set")
        throw new HttpError(409, "account_busy");
      throw reason;
    }
  }
  async folders(uid: string) {
    const folders = (await this.cloud.rows(uid, "folder")).map(
      (row) => recordValue(row).payload as unknown as VocabFolder,
    );
    if (!folders.some((f) => f.id === UNCATEGORIZED_FOLDER_ID))
      folders.unshift({
        id: UNCATEGORIZED_FOLDER_ID,
        name: "未分類",
        order: -1,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      });
    return { folders, revision: agentFoldersRevision(folders) };
  }
  async mutateFolders(
    uid: string,
    revision: string | undefined,
    operationId: string,
    action: AgentFolderMutation,
  ) {
    const hash = await fingerprint(JSON.stringify({ revision, action }));
    const previous = await this.cloud.operation<
      ReturnType<typeof mutateAgentFolders>
    >(uid, operationId, hash);
    if (previous) return previous;
    const head = await this.cloud.head(uid),
      before = await this.folders(uid);
    if (revision !== undefined && before.revision !== revision)
      throw new HttpError(409, "stale_folders");
    const occupied =
      action.type === "delete_folder"
        ? (await this.list(uid)).map((set) => set.folderId)
        : [];
    const result = mutateAgentFolders(
      before.folders,
      action,
      crypto.randomUUID(),
      occupied,
    );
    const now = new Date().toISOString();
    const records: AgentCloudRecord[] = result.folder
      ? [
          {
            type: "folder",
            recordKey: result.folder.id,
            payload: { ...result.folder },
            deleted: false,
            updatedAt: now,
          },
        ]
      : [
          {
            type: "folder",
            recordKey: (action as { folderId: string }).folderId,
            payload: null,
            deleted: true,
            updatedAt: now,
          },
        ];
    return this.cloud.commit(
      uid,
      head,
      records,
      [],
      `agent:${operationId}`,
      operationId,
      hash,
      result,
    );
  }
}
