import { z } from "zod";
import type { Env } from "./env";
import type { AdminAccount } from "@lexiro/ai-contract";
import { adminUsage } from "./admin-usage";
import { accountCursor, encodeCursor, readCursor } from "./pagination";
import { account, BillingError, nextRenewal, nowSeconds } from "./billing";
import { HttpError, readBody } from "./http";

const adjustment = z
  .strictObject({
    addPoints: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    monthly: z.number().int().min(0).max(1_000_000).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
const siteSettings = z
  .strictObject({
    freeTrial: z.boolean().optional(),
    defaultInitial: z.number().int().min(0).max(1_000_000).optional(),
    defaultMonthly: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function adminRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  if (path === "/admin/accounts" && request.method === "GET") {
    const cursor = readCursor(request, accountCursor);
    const query = env.DB.prepare(`SELECT uid,email,points,monthly,renews_at,note FROM accounts
      ${cursor ? "WHERE (email,uid)>(?,?)" : ""} ORDER BY email,uid LIMIT 101`);
    const rows = await (cursor ? query.bind(cursor.email, cursor.uid) : query).all<AdminAccount>();
    const page = rows.results.slice(0, 100);
    const last = page.at(-1)!;
    return Response.json({
      accounts: page,
      nextCursor: rows.results.length > 100 ? encodeCursor({ v: 1, page: "accounts", email: last.email, uid: last.uid }) : null,
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
    const value = parsed.data;
    // A note-only save must preserve even a negative reservation balance.
    // Financial changes wait for settlement; the guard and update are atomic.
    const result = await env.DB.prepare(
      `UPDATE accounts SET
      points=CASE WHEN ?1=0 AND (?2 IS NULL OR ?2=monthly) THEN points
        ELSE MAX(MAX(0,points+?1),CASE WHEN ?2>0 AND ?2<>monthly THEN ?2 ELSE 0 END) END,
      renews_at=CASE WHEN ?2>0 AND ?2<>monthly THEN ?4 ELSE renews_at END,
      monthly=COALESCE(?2,monthly),note=COALESCE(?3,note),updated_at=?5
      WHERE uid=?6 AND (inflight_id IS NULL OR (?1=0 AND (?2 IS NULL OR ?2=monthly)))`,
    )
      .bind(
        value.addPoints ?? 0,
        value.monthly ?? null,
        value.note ?? null,
        nextRenewal(nowSeconds()),
        new Date().toISOString(),
        uid,
      )
      .run();
    if (!result.meta.changes) {
      if (await account(env.DB, uid)) throw new BillingError(409);
      throw new HttpError(404, "not_found");
    }
    return Response.json(await account(env.DB, uid));
  }
  if (path === "/admin/usage" && request.method === "GET")
    return adminUsage(request, env.DB);
  if (path === "/admin/settings" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT key,value FROM settings WHERE key IN ('free_trial','default_initial','default_monthly')",
    ).all<{ key: string; value: string }>();
    const values = Object.fromEntries(
      rows.results.map((entry) => [entry.key, entry.value]),
    );
    return Response.json({
      freeTrial: values.free_trial === "true",
      defaultInitial: Number(values.default_initial),
      defaultMonthly: Number(values.default_monthly),
    });
  }
  if (path === "/admin/settings" && request.method === "PATCH") {
    const parsed = siteSettings.safeParse(
      JSON.parse(await readBody(request, 1000)),
    );
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const entries: [string, boolean | number][] = [];
    if (parsed.data.freeTrial !== undefined)
      entries.push(["free_trial", parsed.data.freeTrial]);
    if (parsed.data.defaultInitial !== undefined)
      entries.push(["default_initial", parsed.data.defaultInitial]);
    if (parsed.data.defaultMonthly !== undefined)
      entries.push(["default_monthly", parsed.data.defaultMonthly]);
    await env.DB.batch(
      entries.map(([key, value]) =>
        env.DB.prepare("UPDATE settings SET value=? WHERE key=?").bind(
          String(value),
          key,
        ),
      ),
    );
    return Response.json(parsed.data);
  }
  throw new HttpError(404, "not_found");
}
