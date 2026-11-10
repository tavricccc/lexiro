import type { CloudClient } from "./cloud-client";
import {
  parseLearningRecord,
  trimLearningRecord,
  type LearningRecord,
} from "./learning-record";

/** The Worker refuses a device record larger than this many bytes of JSON. */
export const CLOUD_LEARNING_MAX_BYTES = 256_000;
/** Kept a little under the limit so the request envelope still fits. */
const PUSH_BUDGET_BYTES = CLOUD_LEARNING_MAX_BYTES - 6_000;

/** Every device's own learning record, keyed by device id. */
export async function readCloudLearning(
  db: CloudClient,
  uid: string,
): Promise<Record<string, LearningRecord>> {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  const { devices } = await db.request<{
    devices: { deviceId: string; record: unknown }[];
  }>("/sync/learning");
  return Object.fromEntries(
    devices.map((entry) => [entry.deviceId, parseLearningRecord(entry.record)]),
  );
}

/** Replaces this device's record in the cloud; no other device writes it. */
export async function writeCloudLearning(
  db: CloudClient,
  uid: string,
  deviceId: string,
  record: LearningRecord,
): Promise<void> {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  await db.request("/sync/learning", {
    deviceId,
    record: trimLearningRecord(record, PUSH_BUDGET_BYTES),
  });
}
