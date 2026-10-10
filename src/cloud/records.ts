import { agentRecordId, type AgentCloudRecord, type AgentSetSnapshot } from "@lexiro/agent-contract";
export interface RecordRow {
  id: string; kind: AgentCloudRecord["type"]; record_key: string;
  payload: string | null; deleted: number; updated_at: string; seq: number;
}
export function recordValue(row: RecordRow): AgentCloudRecord {
  return { type: row.kind, recordKey: row.record_key, payload: row.payload ? JSON.parse(row.payload) : null, deleted: row.deleted === 1, updatedAt: row.updated_at };
}
export function snapshotRecords(snapshot: AgentSetSnapshot | null) {
  const result = new Map<string, AgentCloudRecord>();
  if (!snapshot) return result;
  const put = (type: AgentCloudRecord["type"], key: string, payload: Record<string, unknown>, updatedAt: string) => {
    result.set(agentRecordId(type, key), { type, recordKey: key, deleted: false, payload, updatedAt });
  };
  put("set", snapshot.set.id, { ...snapshot.set }, snapshot.set.updatedAt);
  put("membership", snapshot.set.id, { members: snapshot.memberships }, snapshot.set.updatedAt);
  for (const word of snapshot.words) put("word", word.wordKey, { ...word }, word.updatedAt);
  for (const question of snapshot.questions) put("question", question.id, { ...question }, question.updatedAt);
  return result;
}
export function changedSnapshotRecords(before: AgentSetSnapshot | null, after: AgentSetSnapshot | null) {
  const old = snapshotRecords(before), next = snapshotRecords(after), changed: AgentCloudRecord[] = [];
  for (const [id, record] of next) {
    const previous = old.get(id);
    if (record.type === "membership" && JSON.stringify(previous?.payload) === JSON.stringify(record.payload)) continue;
    if (JSON.stringify(previous) !== JSON.stringify(record)) changed.push(record);
  }
  for (const [id, record] of old) if (!next.has(id)) changed.push({ ...record, deleted: true, payload: null, updatedAt: new Date().toISOString() });
  return changed;
}
