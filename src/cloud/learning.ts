import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { HttpError } from "../http";

/** One device's learning record must stay under this many bytes of JSON. */
export const LEARNING_RECORD_MAX_BYTES = 256_000;
/** Devices kept per account; the least recently written are dropped. */
export const LEARNING_MAX_DEVICES = 20;

const count = z.strictObject({ answered: z.number().int().nonnegative(), correct: z.number().int().nonnegative() })
  .refine(value => value.correct <= value.answered, "correct > answered");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const record = z.strictObject({
  version: z.literal(1),
  goal: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  goalUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  days: z.record(day, count),
  kinds: z.record(z.string().min(1).max(40), count),
  senses: z.record(z.string().min(1).max(200), z.strictObject({
    answered: z.number().int().nonnegative(), correct: z.number().int().nonnegative(),
    wordKey: z.string().max(400), level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), lastDay: day,
  }).refine(value => value.correct <= value.answered, "correct > answered")),
});
const writeSchema = z.strictObject({ deviceId: z.string().uuid(), record });
export type CloudLearningRecord = z.infer<typeof record>;

function invalid(reason: unknown): never {
  const error = new HttpError(400, "invalid_content");
  error.message = reason instanceof Error ? reason.message : "學習紀錄格式錯誤";
  throw error;
}

export async function readLearning(db: D1Database, uid: string) {
  const rows = (await db.prepare("SELECT device_id,data FROM cloud_learning WHERE uid=? ORDER BY updated_at DESC LIMIT ?")
    .bind(uid, LEARNING_MAX_DEVICES).all<{ device_id: string; data: string }>()).results;
  return { devices: rows.map(row => ({ deviceId: row.device_id, record: JSON.parse(row.data) as CloudLearningRecord })) };
}

/** Replaces this device's row. Only that device writes it, so the last write wins. */
export async function writeLearning(db: D1Database, uid: string, body: string) {
  if (body.length > LEARNING_RECORD_MAX_BYTES + 200) throw new HttpError(413, "input_limit", "record");
  let input: z.infer<typeof writeSchema>;
  try { input = writeSchema.parse(JSON.parse(body)); } catch (reason) { invalid(reason); }
  const data = JSON.stringify(input.record);
  if (data.length > LEARNING_RECORD_MAX_BYTES) throw new HttpError(413, "input_limit", "record");
  await db.batch([
    db.prepare("INSERT INTO cloud_learning(uid,device_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(uid,device_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at")
      .bind(uid, input.deviceId, data, Date.now()),
    db.prepare("DELETE FROM cloud_learning WHERE uid=? AND device_id NOT IN (SELECT device_id FROM cloud_learning WHERE uid=? ORDER BY updated_at DESC LIMIT ?)")
      .bind(uid, uid, LEARNING_MAX_DEVICES),
  ]);
  return { ok: true };
}
