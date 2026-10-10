import { z } from "zod";
import { cloudRecordId, validateCloudRecord } from "@/src/lib/cloud-records";
import { normalizeCloudProgress, normalizeCloudStats } from "@/src/lib/cloud-sync-schema";
import { normalizeAiPreferences } from "@/src/lib/ai-preferences";
const record = z.strictObject({
  type: z.enum(["folder", "set", "membership", "word", "question"]),
  recordKey: z.string().min(1), deleted: z.boolean(), updatedAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});
export function agentCloudRecord(value: unknown, uid: string) {
  const parsed = record.parse(value);
  return validateCloudRecord({ ...parsed, ownerId: uid, schemaVersion: 9 }, uid,
    cloudRecordId({ kind: parsed.type, id: parsed.recordKey }));
}
export function agentCloudBlob(kind: "progress" | "stats" | "preferences", value: unknown, uid: string) {
  const envelope = { ...z.record(z.string(), z.unknown()).parse(value), ownerId: uid, schemaVersion: 9 };
  const normalized = kind === "progress" ? normalizeCloudProgress(envelope, uid)
    : kind === "stats" ? normalizeCloudStats(envelope, uid) : normalizeAiPreferences(value);
  return { ...normalized, ownerId: uid, schemaVersion: kind === "preferences" ? 1 : 9 };
}
