import {
  agentRecordId, agentSetRevision, agentFoldersRevision, mutateAgentFolders,
  validateAgentSnapshot, UNCATEGORIZED_FOLDER_ID,
  type AgentSetSnapshot, type AgentMutationResult, type AgentFolderMutation,
  type VocabFolder, type AgentCloudRecord,
} from "@lexiro/agent-contract";
import type { AgentEnv, AgentLibraryRepository, MutationReceipt } from "./types";
import { CloudD1Repository, type AccountHead, type BlobWrite } from "../cloud/repository";
import { changedSnapshotRecords, recordValue, type RecordRow } from "../cloud/records";
import { fingerprint, HttpError } from "../http";

export class D1AgentLibrary implements AgentLibraryRepository {
  private cloud: CloudD1Repository;
  constructor(private env: AgentEnv) { this.cloud = new CloudD1Repository(env.CLOUD_DB); }
  async list(uid: string) {
    return (await this.cloud.rows(uid, "set")).map(row => {
      const set = JSON.parse(row.payload!) as AgentSetSnapshot["set"];
      return { id: set.id, setName: set.setName, folderId: set.folderId };
    });
  }
  private async load(uid: string, setId: string) {
    const db = this.env.CLOUD_DB;
    const result = await db.batch([
      db.prepare("SELECT revision,blob_revision,changed_by,blob_changed_by FROM cloud_accounts WHERE uid=?").bind(uid),
      db.prepare("SELECT id,kind,record_key,payload,deleted,updated_at,seq FROM cloud_records WHERE uid=? AND id IN (?,?) AND deleted=0").bind(uid, agentRecordId("set", setId), agentRecordId("membership", setId)),
      db.prepare("SELECT r.* FROM cloud_memberships m CROSS JOIN cloud_records r INDEXED BY cloud_records_key WHERE m.uid=? AND m.set_id=? AND r.uid=m.uid AND r.kind='word' AND r.record_key=m.word_key AND r.deleted=0 ORDER BY r.id").bind(uid, setId),
      db.prepare("SELECT r.* FROM cloud_records r INDEXED BY cloud_records_key WHERE r.uid=? AND r.kind='question' AND r.deleted=0 AND r.record_key IN (SELECT q.question_id FROM cloud_memberships m CROSS JOIN cloud_question_sources q WHERE m.uid=? AND m.set_id=? AND q.uid=m.uid AND q.word_key=m.word_key) ORDER BY r.id").bind(uid, uid, setId),
      db.prepare("SELECT kind,data FROM cloud_blobs WHERE uid=?").bind(uid),
    ]);
    const head = (result[0].results[0] as unknown as AccountHead | undefined) ?? { revision: 0, blob_revision: 0, changed_by: "", blob_changed_by: "" };
    const rows = result[1].results as unknown as RecordRow[];
    const set = rows.find(row => row.kind === "set");
    const blobs = (result[4].results as unknown as { kind: BlobWrite["kind"]; data: string }[]).map(row => ({ kind: row.kind, data: JSON.parse(row.data) as Record<string, unknown> }));
    if (!set) return { snapshot: null, head, blobs };
    const membership = rows.find(row => row.kind === "membership");
    if (!membership) throw new HttpError(409, "set_sync_incomplete");
    const snapshot = validateAgentSnapshot({
      set: JSON.parse(set.payload!),
      memberships: JSON.parse(membership.payload!).members,
      words: (result[2].results as unknown as RecordRow[]).map(row => JSON.parse(row.payload!)),
      questions: (result[3].results as unknown as RecordRow[]).map(row => JSON.parse(row.payload!)),
    }, setId);
    return { snapshot, head, blobs };
  }
  async read(uid: string, setId: string) { return (await this.load(uid, setId)).snapshot; }
  private async folderExists(uid: string, id: string) {
    if (id === UNCATEGORIZED_FOLDER_ID) return;
    const row = await this.env.CLOUD_DB.prepare("SELECT id FROM cloud_records WHERE uid=? AND id=? AND kind='folder' AND deleted=0").bind(uid, agentRecordId("folder", id)).first();
    if (!row) throw new HttpError(400, "folder_not_found");
  }
  async create(uid: string, snapshot: AgentSetSnapshot) {
    const before = await this.load(uid, snapshot.set.id);
    if (before.snapshot) throw new HttpError(409, "set_exists");
    await this.folderExists(uid, snapshot.set.folderId);
    const valid = validateAgentSnapshot(snapshot, snapshot.set.id), id = crypto.randomUUID();
    await this.cloud.commit(uid, before.head, changedSnapshotRecords(null, valid), [], "agent:create", id, await fingerprint(JSON.stringify(valid)), { created: valid.set.id });
  }
  async mutate(uid: string, setId: string, revision: string, operationId: string, action: unknown, apply: (snapshot: AgentSetSnapshot) => AgentMutationResult) {
    const hash = await fingerprint(JSON.stringify({ setId, revision, action }));
    const previous = await this.cloud.operation<MutationReceipt>(uid, operationId, hash);
    if (previous) return previous;
    const before = await this.load(uid, setId);
    if (!before.snapshot) throw new HttpError(404, "set_not_found");
    if (agentSetRevision(before.snapshot) !== revision) throw new HttpError(409, "stale_set");
    const { snapshot: after, senseRemaps } = apply(before.snapshot);
    if (after) await this.folderExists(uid, after.set.folderId);
    const records = changedSnapshotRecords(before.snapshot, after);
    const oldQuestions = new Set(before.snapshot.questions.map(q => q.id));
    for (const record of records) if (record.type === "question" && !record.deleted && !oldQuestions.has(record.recordKey)) {
      const collision = await this.env.CLOUD_DB.prepare("SELECT id FROM cloud_records WHERE uid=? AND id=? AND deleted=0").bind(uid, agentRecordId("question", record.recordKey)).first();
      if (collision) throw new HttpError(403, "question_outside_scope");
    }
    const surviving = new Set(after?.words.flatMap(w => w.senses.map(s => s.id)) ?? []);
    const removed = before.snapshot.words.flatMap(w => w.senses.map(s => s.id)).filter(id => !surviving.has(id));
    const blobs: BlobWrite[] = [];
    if (removed.length) for (const blob of before.blobs) {
      if (blob.kind === "preferences") continue;
      const key = blob.kind === "progress" ? "cards" : "questionStatsBySense";
      const items = { ...(blob.data[key] as Record<string, unknown>) };
      for (const remap of senseRemaps) if (items[remap.from] !== undefined && items[remap.to] === undefined) items[remap.to] = items[remap.from];
      for (const id of removed) delete items[id];
      blobs.push({ kind: blob.kind, data: { ...blob.data, [key]: items, updatedAt: new Date().toISOString() } });
    }
    const receipt: MutationReceipt = { operationId, setId, revision: agentSetRevision(after), wordCount: after?.words.length ?? 0, questionCount: after?.questions.length ?? 0, deleted: !after };
    return this.cloud.commit(uid, before.head, records, blobs, `agent:${operationId}`, operationId, hash, receipt);
  }
  async folders(uid: string) {
    const folders = (await this.cloud.rows(uid, "folder")).map(row => recordValue(row).payload as unknown as VocabFolder);
    if (!folders.some(f => f.id === UNCATEGORIZED_FOLDER_ID)) folders.unshift({ id: UNCATEGORIZED_FOLDER_ID, name: "未分類", order: -1, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() });
    return { folders, revision: agentFoldersRevision(folders) };
  }
  async mutateFolders(uid: string, revision: string, operationId: string, action: AgentFolderMutation) {
    const hash = await fingerprint(JSON.stringify({ revision, action }));
    const previous = await this.cloud.operation<ReturnType<typeof mutateAgentFolders>>(uid, operationId, hash);
    if (previous) return previous;
    const head = await this.cloud.head(uid), before = await this.folders(uid);
    if (before.revision !== revision) throw new HttpError(409, "stale_folders");
    const occupied = action.type === "delete_folder" ? (await this.list(uid)).map(set => set.folderId) : [];
    const result = mutateAgentFolders(before.folders, action, crypto.randomUUID(), occupied);
    const now = new Date().toISOString();
    const records: AgentCloudRecord[] = result.folder ? [{ type: "folder", recordKey: result.folder.id, payload: { ...result.folder }, deleted: false, updatedAt: now }]
      : [{ type: "folder", recordKey: (action as { folderId: string }).folderId, payload: null, deleted: true, updatedAt: now }];
    return this.cloud.commit(uid, head, records, [], `agent:${operationId}`, operationId, hash, result);
  }
}
