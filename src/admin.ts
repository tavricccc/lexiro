import { z } from "zod";
import type { Env } from "./env";
import type {
  AdminAccount,
  AdminAccountAdjustment,
  AdminSettingsValue,
  AdminSettingsAdjustment,
} from "@lexiro/ai-contract";
import { adminUsage } from "./admin-usage";
import { accountCursor, encodeCursor, readCursor } from "./pagination";
import { account, BillingError, nextRenewal, nowSeconds } from "./billing";
import { HttpError, readBody } from "./http";

const adjustment = z
  .strictObject({
    expected: z.strictObject({
      version: z.number().int().min(0),
      points: z.number().int(),
      monthly: z.number().int().min(0).max(1_000_000),
      renews_at: z.number().int().min(0),
      note: z.string().max(500).nullable(),
    }),
    addPoints: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    monthly: z.number().int().min(0).max(1_000_000).optional(),
    note: z.string().max(500).optional(),
  })
  .refine(
    (value) =>
      value.addPoints !== undefined ||
      value.monthly !== undefined ||
      value.note !== undefined,
  );
const siteSettings = z
  .strictObject({
    expected: z.strictObject({
      version: z.number().int().min(0),
      freeTrial: z.boolean(),
      defaultInitial: z.number().int().min(0).max(1_000_000),
      defaultMonthly: z.number().int().min(0).max(1_000_000),
    }),
    freeTrial: z.boolean().optional(),
    defaultInitial: z.number().int().min(0).max(1_000_000).optional(),
    defaultMonthly: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine(
    (value) =>
      value.freeTrial !== undefined ||
      value.defaultInitial !== undefined ||
      value.defaultMonthly !== undefined,
  );

export async function adminRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  if (path === "/admin/accounts" && request.method === "GET") {
    const cursor = readCursor(request, accountCursor);
    const query = env.DB
      .prepare(`SELECT uid,email,points,monthly,renews_at,note,version FROM accounts
      ${cursor ? "WHERE (email,uid)>(?,?)" : ""} ORDER BY email,uid LIMIT 101`);
    const rows = await (
      cursor ? query.bind(cursor.email, cursor.uid) : query
    ).all<AdminAccount>();
    const page = rows.results.slice(0, 100);
    const last = page.at(-1)!;
    return Response.json({
      accounts: page,
      nextCursor:
        rows.results.length > 100
          ? encodeCursor({
              v: 1,
              page: "accounts",
              email: last.email,
              uid: last.uid,
            })
          : null,
    });
  }
  if (path.startsWith("/admin/accounts/") && request.method === "GET") {
    const uid = decodeURIComponent(path.slice("/admin/accounts/".length));
    const result = await account(env.DB, uid);
    if (!result) throw new HttpError(404, "not_found");
    return Response.json(result);
  }
  if (path.startsWith("/admin/accounts/") && request.method === "PATCH") {
    const uid = decodeURIComponent(path.slice("/admin/accounts/".length));
    const parsed = adjustment.safeParse(
      JSON.parse(await readBody(request, 10_000)),
    );
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const value: AdminAccountAdjustment = parsed.data;
    // A note-only save must preserve even a negative reservation balance.
    // Financial changes wait for settlement; the guard and update are atomic.
    const result = await env.DB.prepare(
      `UPDATE accounts SET version=version+1,
      points=CASE WHEN ?1=0 AND (?2 IS NULL OR ?2=monthly) THEN points
        ELSE MAX(MAX(0,points+?1),CASE WHEN ?2>0 AND ?2<>monthly THEN ?2 ELSE 0 END) END,
      renews_at=CASE WHEN ?2>0 AND ?2<>monthly THEN ?4 ELSE renews_at END,
      monthly=COALESCE(?2,monthly),note=COALESCE(?3,note),updated_at=?5
      WHERE uid=?6 AND (inflight_id IS NULL OR (?1=0 AND (?2 IS NULL OR ?2=monthly)))
        AND points=?7 AND monthly=?8 AND renews_at=?9 AND note IS ?10 AND version=?11
      RETURNING uid,email,points,monthly,renews_at,note,version`,
    )
      .bind(
        value.addPoints ?? 0,
        value.monthly ?? null,
        value.note ?? null,
        nextRenewal(nowSeconds()),
        new Date().toISOString(),
        uid,
        value.expected.points,
        value.expected.monthly,
        value.expected.renews_at,
        value.expected.note,
        value.expected.version,
      )
      .first<AdminAccount>();
    if (!result) {
      const current = await account(env.DB, uid);
      if (current) {
        if (
          Object.entries(value.expected).some(
            ([key, expected]) =>
              current[key as keyof typeof value.expected] !== expected,
          )
        )
          throw new HttpError(409, "stale_account");
        throw new BillingError(409);
      }
      throw new HttpError(404, "not_found");
    }
    return Response.json(result);
  }
  if (path === "/admin/usage" && request.method === "GET")
    return adminUsage(request, env.DB);
  if (path === "/admin/settings" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT key,value,version FROM settings WHERE key IN ('free_trial','default_initial','default_monthly')",
    ).all<{ key: string; value: string; version: number }>();
    return settingsResponse(rows.results);
  }
  if (path === "/admin/settings" && request.method === "PATCH") {
    const parsed = siteSettings.safeParse(
      JSON.parse(await readBody(request, 1000)),
    );
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const value: AdminSettingsAdjustment = parsed.data;
    // Materialize the pre-write snapshot once; updating one row cannot invalidate the next.
    const saved = await env.DB.prepare(
      `WITH snapshot AS MATERIALIZED (
      SELECT COUNT(*) AS matched FROM settings WHERE version=?7 AND (
        (key='free_trial' AND value=?1) OR (key='default_initial' AND value=?2) OR (key='default_monthly' AND value=?3))
      ) UPDATE settings SET version=version+1,value=CASE key
        WHEN 'free_trial' THEN COALESCE(?4,value)
        WHEN 'default_initial' THEN COALESCE(?5,value)
        WHEN 'default_monthly' THEN COALESCE(?6,value) END
      WHERE key IN ('free_trial','default_initial','default_monthly') AND (SELECT matched FROM snapshot)=3
      RETURNING key,value,version`,
    )
      .bind(
        String(value.expected.freeTrial),
        String(value.expected.defaultInitial),
        String(value.expected.defaultMonthly),
        value.freeTrial === undefined ? null : String(value.freeTrial),
        value.defaultInitial === undefined
          ? null
          : String(value.defaultInitial),
        value.defaultMonthly === undefined
          ? null
          : String(value.defaultMonthly),
        value.expected.version,
      )
      .all<{ key: string; value: string; version: number }>();
    if (saved.results.length !== 3) throw new HttpError(409, "stale_settings");
    return settingsResponse(saved.results);
  }
  throw new HttpError(404, "not_found");
}

function settingsResponse(
  rows: { key: string; value: string; version: number }[],
) {
  const values = Object.fromEntries(
    rows.map((entry) => [entry.key, entry.value]),
  );
  return Response.json({
    version: rows[0].version,
    freeTrial: values.free_trial === "true",
    defaultInitial: Number(values.default_initial),
    defaultMonthly: Number(values.default_monthly),
  } satisfies AdminSettingsValue);
}
