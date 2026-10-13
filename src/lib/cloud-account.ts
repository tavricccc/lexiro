import type { CloudClient } from "./cloud-client";
import { SYNC_ORIGIN_ID } from "./cloud-sync";
import { randomUUID } from "./id";
import { normalizeCloudPreferences } from "./cloud-preferences";
import type { AiPreferences } from "./ai-preferences";

export interface CloudBlobs {
  preferences: AiPreferences | null;
}

export async function readCloudBlobs(
  db: CloudClient,
  uid: string,
  signal?: AbortSignal,
): Promise<CloudBlobs> {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  const { blobs, revision } = await db.request<{
    blobs: { preferences?: unknown };
    revision: number;
  }>("/sync/blobs", undefined, signal);
  db.blobRevision = revision;
  return {
    preferences: blobs.preferences
      ? normalizeCloudPreferences(blobs.preferences, uid)
      : null,
  };
}

export async function writeCloudBlob(
  db: CloudClient,
  uid: string,
  kind: "preferences",
  data: unknown,
  signal?: AbortSignal,
) {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  const result = await db.request<{ revision: number }>(
    "/sync/blobs",
    {
      expectedRevision: db.blobRevision,
      blobs: [{ kind, data }],
      origin: SYNC_ORIGIN_ID,
      operationId: randomUUID(),
    },
    signal,
  );
  db.blobRevision = result.revision;
}
