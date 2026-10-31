import type { FirebaseIdentity } from "../auth";
import type { AgentEnv } from "./types";

/** A profile is rewritten when it changed, or when this much time has passed. */
const REFRESH_MS = 24 * 3600 * 1000;

/**
 * Remembers the email and name on a verified token so the operator can tell
 * accounts apart. The upsert only writes when something differs, so a busy
 * account costs a read, not a write. A failure never fails the request.
 */
export async function recordProfile(
  db: AgentEnv["AGENT_DB"],
  identity: FirebaseIdentity,
  now = Date.now(),
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO account_profiles(uid,email,name,seen_at) VALUES(?1,?2,?3,?4) ON CONFLICT(uid) DO UPDATE SET email=excluded.email,name=excluded.name,seen_at=excluded.seen_at WHERE email<>excluded.email OR name<>excluded.name OR seen_at<?5",
    )
    .bind(
      identity.uid,
      identity.email.slice(0, 320),
      (identity.name ?? "").slice(0, 100),
      now,
      now - REFRESH_MS,
    )
    .run()
    .catch(() => {});
}
