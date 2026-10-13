import { z } from "zod";
import { cloudRecordId, validateCloudRecord } from "@/src/lib/cloud-records";
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
export function agentCloudBlob(kind: "preferences", value: unknown, uid: string) {
  z.record(z.string(), z.unknown()).parse(value);
  return { ...normalizeAiPreferences(value), ownerId: uid, schemaVersion: 1 };
}
