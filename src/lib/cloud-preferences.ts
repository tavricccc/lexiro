import { getDoc, onSnapshot, setDoc, type Firestore } from "firebase/firestore";
import { cloudDocument, SYNC_ORIGIN_ID, withDeadline } from "./cloud-sync";
import { normalizeAiPreferences, type AiPreferences } from "./ai-preferences";
import { isRecord } from "./schema";
import { CloudSyncError } from "./cloud-sync-errors";

export async function readCloudPreferences(
  db: Firestore,
  uid: string,
): Promise<AiPreferences | null> {
  const snapshot = await withDeadline(
    getDoc(cloudDocument(db, uid, "preferences", "ai")),
    "AI preferences download",
  );
  if (!snapshot.exists()) return null;
  const value: unknown = snapshot.data();
  if (
    !isRecord(value) ||
    value.ownerId !== uid ||
    typeof value.changedBy !== "string" ||
    Object.keys(value).some(
      (key) =>
        ![
          "ownerId",
          "changedBy",
          "schemaVersion",
          "model",
          "updatedAt",
        ].includes(key),
    )
  ) {
    throw new CloudSyncError("cloud/data-invalid", "AI 模型設定格式錯誤");
  }
  return normalizeAiPreferences(value);
}

export async function writeCloudPreferences(
  db: Firestore,
  uid: string,
  preferences: AiPreferences,
): Promise<void> {
  await withDeadline(
    setDoc(cloudDocument(db, uid, "preferences", "ai"), {
      ...preferences,
      ownerId: uid,
      changedBy: SYNC_ORIGIN_ID,
    }),
    "AI preferences upload",
  );
}

/** Model changes must reach an open second device without a Library edit. */
export function watchCloudPreferences(
  db: Firestore,
  uid: string,
  onChange: () => void,
): () => void {
  let seen: string | null = null;
  return onSnapshot(cloudDocument(db, uid, "preferences", "ai"), (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;
    const stamp = snapshot.exists()
      ? `${snapshot.get("model")}:${snapshot.get("updatedAt")}`
      : "";
    const previous = seen;
    seen = stamp;
    if (
      previous === null ||
      previous === stamp ||
      (snapshot.exists() && snapshot.get("changedBy") === SYNC_ORIGIN_ID)
    )
      return;
    onChange();
  });
}
