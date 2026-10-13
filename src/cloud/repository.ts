import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { agentRecordId, type AgentCloudRecord } from "@lexiro/agent-contract";
import { HttpError } from "../http";
import { recordValue, type RecordRow } from "./records";
export interface AccountHead { revision: number; blob_revision: number; changed_by: string; blob_changed_by: string }
export type BlobKind = "preferences";
export interface BlobWrite { kind: BlobKind; data: Record<string, unknown> }
export class CloudD1Repository {
  constructor(readonly db: D1Database) {}
  async head(uid: string): Promise<AccountHead> {
    return await this.db.prepare("SELECT revision,blob_revision,changed_by,blob_changed_by FROM cloud_accounts WHERE uid=?").bind(uid).first<AccountHead>()
      ?? { revision: 0, blob_revision: 0, changed_by: "", blob_changed_by: "" };
  }
  async operation<T>(uid: string, id: string, hash: string): Promise<T | null> {
    const row = await this.db.prepare("SELECT input_hash,result FROM cloud_operations WHERE uid=? AND operation_id=?").bind(uid, id).first<{ input_hash: string; result: string }>();
    if (!row) return null;
    if (row.input_hash !== hash) throw new HttpError(409, "operation_conflict");
    return JSON.parse(row.result) as T;
  }
  async rows(uid: string, kind: string) {
    return (await this.db.prepare("SELECT id,kind,record_key,payload,deleted,updated_at,seq FROM cloud_records WHERE uid=? AND kind=? AND deleted=0").bind(uid, kind).all<RecordRow>()).results;
  }
  async blobs(uid: string) {
    const rows = (await this.db.prepare("SELECT kind,data FROM cloud_blobs WHERE uid=? AND kind='preferences'").bind(uid).all<{ kind: BlobKind; data: string }>()).results;
    return Object.fromEntries(rows.map(row => [row.kind, JSON.parse(row.data)])) as Partial<Record<BlobKind, Record<string, unknown>>>;
  }
  async pull(uid: string, cursor: string, limit = 400) {
    const match = cursor ? /^(\d+)\|([a-z]+-[a-f0-9]{32})$/.exec(cursor) : null;
    if (cursor && !match) throw new HttpError(400, "invalid_cursor");
    const seq = match ? Number(match[1]) : 0, id = match?.[2] ?? "";
    const rows = (await this.db.prepare("SELECT id,kind,record_key,payload,deleted,updated_at,seq FROM cloud_records WHERE uid=? AND (seq>? OR (seq=? AND id>?)) ORDER BY seq,id LIMIT ?").bind(uid, seq, seq, id, limit + 1).all<RecordRow>()).results;
    const page = rows.slice(0, limit), last = page.at(-1);
    return { records: page.map(recordValue), cursor: last ? `${last.seq}|${last.id}` : cursor, hasMore: rows.length > limit };
  }
  /** All statements share one CAS ticket and one D1 batch transaction. */
  async commit<T>(uid: string, expected: Pick<AccountHead, "revision" | "blob_revision">, records: AgentCloudRecord[], blobs: BlobWrite[], origin: string, operationId: string, hash: string, result: T) {
    const replay = await this.operation<T>(uid, operationId, hash);
    if (replay) return replay;
    const ticket = crypto.randomUUID();
    const data = JSON.stringify(records.map(record => ({ ...record, id: agentRecordId(record.type, record.recordKey) })));
    const guard = "EXISTS(SELECT 1 FROM cloud_accounts WHERE uid=? AND write_token=?)";
    const statements: D1PreparedStatement[] = [
      this.db.prepare("INSERT OR IGNORE INTO cloud_accounts(uid) VALUES(?)").bind(uid),
      this.db.prepare("UPDATE cloud_accounts SET revision=revision+?,blob_revision=blob_revision+?,changed_by=CASE WHEN ? THEN ? ELSE changed_by END,blob_changed_by=CASE WHEN ? THEN ? ELSE blob_changed_by END,write_token=? WHERE uid=? AND revision=? AND blob_revision=?")
        .bind(records.length ? 1 : 0, blobs.length ? 1 : 0, records.length ? 1 : 0, origin, blobs.length ? 1 : 0, origin, ticket, uid, expected.revision, expected.blob_revision),
    ];
    if (records.length) {
      statements.push(this.db.prepare(`INSERT INTO cloud_records(uid,id,kind,record_key,payload,deleted,updated_at,seq)
        SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.recordKey'),CASE WHEN json_extract(value,'$.deleted') THEN NULL ELSE json_extract(value,'$.payload') END,json_extract(value,'$.deleted'),json_extract(value,'$.updatedAt'),(SELECT revision FROM cloud_accounts WHERE uid=?)
        FROM json_each(?) WHERE ${guard}
        ON CONFLICT(uid,id) DO UPDATE SET kind=excluded.kind,record_key=excluded.record_key,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at,seq=excluded.seq
        WHERE cloud_records.payload IS NOT excluded.payload OR cloud_records.deleted<>excluded.deleted OR cloud_records.updated_at<>excluded.updated_at`).bind(uid, uid, data, uid, ticket));
      statements.push(this.db.prepare(`DELETE FROM cloud_memberships AS old WHERE uid=? AND set_id IN(SELECT json_extract(value,'$.recordKey') FROM json_each(?) WHERE json_extract(value,'$.type')='membership')
        AND NOT EXISTS(SELECT 1 FROM json_each(?) r,json_each(r.value,'$.payload.members') m WHERE json_extract(r.value,'$.recordKey')=old.set_id AND json_extract(r.value,'$.type')='membership' AND json_extract(r.value,'$.deleted')=0 AND json_extract(m.value,'$.wordKey')=old.word_key) AND ${guard}`).bind(uid, data, data, uid, ticket));
      statements.push(this.db.prepare(`INSERT INTO cloud_memberships(uid,set_id,word_key,sense_ids)
        SELECT ?,json_extract(r.value,'$.recordKey'),json_extract(m.value,'$.wordKey'),json_extract(m.value,'$.senseIds') FROM json_each(?) r,json_each(r.value,'$.payload.members') m
        WHERE json_extract(r.value,'$.type')='membership' AND json_extract(r.value,'$.deleted')=0 AND ${guard}
        ON CONFLICT(uid,set_id,word_key) DO UPDATE SET sense_ids=excluded.sense_ids WHERE cloud_memberships.sense_ids<>excluded.sense_ids`).bind(uid, data, uid, ticket));
      statements.push(this.db.prepare(`DELETE FROM cloud_question_sources AS old WHERE uid=? AND question_id IN(SELECT json_extract(value,'$.recordKey') FROM json_each(?) WHERE json_extract(value,'$.type')='question')
        AND NOT EXISTS(SELECT 1 FROM json_each(?) r,json_each(CASE WHEN json_extract(r.value,'$.payload.kind')='reading' THEN json_extract(r.value,'$.payload.wordKeys') ELSE json_array(json_extract(r.value,'$.payload.wordKey')) END) s WHERE json_extract(r.value,'$.recordKey')=old.question_id AND json_extract(r.value,'$.type')='question' AND json_extract(r.value,'$.deleted')=0 AND s.value=old.word_key) AND ${guard}`).bind(uid, data, data, uid, ticket));
      statements.push(this.db.prepare(`INSERT OR IGNORE INTO cloud_question_sources(uid,question_id,word_key)
        SELECT ?,json_extract(r.value,'$.recordKey'),s.value FROM json_each(?) r,json_each(CASE WHEN json_extract(r.value,'$.payload.kind')='reading' THEN json_extract(r.value,'$.payload.wordKeys') ELSE json_array(json_extract(r.value,'$.payload.wordKey')) END) s
        WHERE json_extract(r.value,'$.type')='question' AND json_extract(r.value,'$.deleted')=0 AND s.value IS NOT NULL AND ${guard}`).bind(uid, data, uid, ticket));
    }
    for (const blob of blobs) statements.push(this.db.prepare(`INSERT INTO cloud_blobs(uid,kind,data) SELECT ?,?,? WHERE ${guard} ON CONFLICT(uid,kind) DO UPDATE SET data=excluded.data`).bind(uid, blob.kind, JSON.stringify(blob.data), uid, ticket));
    statements.push(this.db.prepare(`INSERT INTO cloud_operations(uid,operation_id,input_hash,result,created_at) SELECT ?,?,?,?,? WHERE ${guard}`).bind(uid, operationId, hash, JSON.stringify(result), new Date().toISOString(), uid, ticket));
    const applied = await this.db.batch(statements);
    if (!applied[1].meta.changes) {
      const won = await this.operation<T>(uid, operationId, hash);
      if (won) return won;
      throw new HttpError(409, "stale_set");
    }
    return result;
  }
}
