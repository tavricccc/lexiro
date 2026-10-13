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
/**
 * The open practice session, so another device can pick it up. The snapshot is
 * opaque here: only the client that resumes it can check it against its Library.
 * A null snapshot records that the session was finished or abandoned.
 */
const practice = z.object({
  updatedAt: z.iso.datetime(),
  snapshot: z.record(z.string(), z.unknown()).nullable(),
});
export function agentCloudBlob(
  kind: "preferences" | "practice",
  value: unknown,
  uid: string,
) {
  z.record(z.string(), z.unknown()).parse(value);
  if (kind === "practice") {
    const { updatedAt, snapshot } = practice.parse(value);
    return { updatedAt, snapshot, ownerId: uid, schemaVersion: 1 };
  }
  return { ...normalizeAiPreferences(value), ownerId: uid, schemaVersion: 1 };
}
