import { z } from "zod";
import { isAdministrator, type FirebaseIdentity } from "../auth";
import { HttpError, readBody } from "../http";
import type { AgentEnv } from "./types";
import { AGENT_PAUSED_FLAG } from "./guard";

/** How many busy accounts the overview lists. */
const TOP_ACCOUNTS = 50;
const UID = /^[A-Za-z0-9]{1,128}$/;
const disableInput = z.strictObject({ reason: z.string().max(200).default("") });

export interface AdminAccount {
  uid: string;
  writesToday: number;
  storedBytes: number;
  readsToday: number;
  disabled: boolean;
}
export interface AdminOverview {
  day: string;
  accounts: number;
  activeToday: number;
  writesToday: number;
  readsToday: number;
  storedBytes: number;
  agentPaused: boolean;
  disabled: { uid: string; reason: string; disabledAt: number }[];
  top: AdminAccount[];
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Admin identity comes from the verified token and ADMIN_EMAILS, nothing else. */
export function requireAdministrator(
  env: AgentEnv,
  identity: FirebaseIdentity,
): void {
  if (!isAdministrator(identity, env.ADMIN_EMAILS ?? ""))
    throw new HttpError(403, "forbidden");
}

export async function adminOverview(
  env: AgentEnv,
  now: number,
): Promise<AdminOverview> {
  const day = dayOf(now);
  const [totals, top, reads, disabled, paused] = await Promise.all([
    env.CLOUD_DB.prepare(
      "SELECT COUNT(*) AS accounts,COALESCE(SUM(quota_day=?1),0) AS active,COALESCE(SUM(CASE WHEN quota_day=?1 THEN quota_writes ELSE 0 END),0) AS writes,COALESCE(SUM(stored_bytes),0) AS bytes FROM cloud_accounts",
    )
      .bind(day)
      .first<{ accounts: number; active: number; writes: number; bytes: number }>(),
    env.CLOUD_DB.prepare(
      "SELECT uid,CASE WHEN quota_day=?1 THEN quota_writes ELSE 0 END AS writes,stored_bytes AS bytes FROM cloud_accounts ORDER BY writes DESC,stored_bytes DESC LIMIT ?2",
    )
      .bind(day, TOP_ACCOUNTS)
      .all<{ uid: string; writes: number; bytes: number }>(),
    env.AGENT_DB.prepare(
      "SELECT uid,rows FROM account_reads WHERE day=?1 ORDER BY rows DESC",
    )
      .bind(day)
      .all<{ uid: string; rows: number }>(),
    env.AGENT_DB.prepare(
      "SELECT uid,reason,disabled_at AS disabledAt FROM disabled_accounts ORDER BY disabled_at DESC LIMIT 200",
    ).all<{ uid: string; reason: string; disabledAt: number }>(),
    env.AGENT_DB.prepare("SELECT 1 AS paused FROM service_flags WHERE name=?")
      .bind(AGENT_PAUSED_FLAG)
      .first(),
  ]);
  const readsByUid = new Map(reads.results.map((row) => [row.uid, row.rows]));
  const disabledUids = new Set(disabled.results.map((row) => row.uid));
  return {
    day,
    accounts: totals?.accounts ?? 0,
    activeToday: totals?.active ?? 0,
    writesToday: totals?.writes ?? 0,
    readsToday: reads.results.reduce((sum, row) => sum + row.rows, 0),
    storedBytes: totals?.bytes ?? 0,
    agentPaused: Boolean(paused),
    disabled: disabled.results,
    top: top.results.map((row) => ({
      uid: row.uid,
      writesToday: row.writes,
      storedBytes: row.bytes,
      readsToday: readsByUid.get(row.uid) ?? 0,
      disabled: disabledUids.has(row.uid),
    })),
  };
}

/**
 * /admin routes for a request that already carried a verified Firebase ID
 * token. `status` answers every signed-in user so the app knows whether to
 * show the entry; everything else is for administrators only.
 */
export async function handleAdminApi(
  request: Request,
  env: AgentEnv,
  identity: FirebaseIdentity,
  now = Date.now(),
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/admin/status" && request.method === "GET")
    return Response.json({
      admin: isAdministrator(identity, env.ADMIN_EMAILS ?? ""),
    });
  requireAdministrator(env, identity);
  if (path === "/admin/overview" && request.method === "GET")
    return Response.json(await adminOverview(env, now));
  const target = /^\/admin\/accounts\/([^/]+)\/disabled$/.exec(path);
  if (target) {
    const uid = decodeURIComponent(target[1]);
    if (!UID.test(uid)) throw new HttpError(400, "invalid_uid");
    if (request.method === "PUT") {
      // Locking yourself out would leave nobody to undo it from the app.
      if (uid === identity.uid) throw new HttpError(400, "cannot_disable_self");
      const { reason } = disableInput.parse(
        JSON.parse((await readBody(request, 2000)) || "{}"),
      );
      await env.AGENT_DB.prepare(
        "INSERT INTO disabled_accounts(uid,reason,disabled_at) VALUES(?1,?2,?3) ON CONFLICT(uid) DO UPDATE SET reason=excluded.reason,disabled_at=excluded.disabled_at",
      )
        .bind(uid, reason, now)
        .run();
      return Response.json({ uid, disabled: true });
    }
    if (request.method === "DELETE") {
      await env.AGENT_DB.prepare("DELETE FROM disabled_accounts WHERE uid=?")
        .bind(uid)
        .run();
      return Response.json({ uid, disabled: false });
    }
  }
  throw new HttpError(404, "not_found");
}
