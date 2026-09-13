import { z } from "zod";
import type { Env } from "./env";
import { account, nextRenewal, nowSeconds } from "./billing";
import { HttpError, readBody } from "./http";

const creation = z.strictObject({ uid: z.string().min(1).max(128), email: z.email(), points: z.number().int().min(0).max(1_000_000), monthly: z.number().int().min(0).max(1_000_000), note: z.string().max(500).default("") });
const adjustment = z.strictObject({ addPoints: z.number().int().min(-1_000_000).max(1_000_000).optional(), monthly: z.number().int().min(0).max(1_000_000).optional(), note: z.string().max(500).optional() }).refine((value) => Object.keys(value).length > 0);
const siteSettings = z
  .strictObject({
    freeTrial: z.boolean().optional(),
    trialPoints: z.number().int().min(0).max(1_000_000).optional(),
    defaultInitial: z.number().int().min(0).max(1_000_000).optional(),
    defaultMonthly: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function adminRequest(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/admin/accounts" && request.method === "GET") {
    const url = new URL(request.url), offset = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, "invalid_input");
    const rows = await env.DB.prepare("SELECT uid,email,points,monthly,renews_at,note FROM accounts ORDER BY email,uid LIMIT 101 OFFSET ?").bind(offset).all();
    return Response.json({ accounts: rows.results.slice(0,100), nextOffset: rows.results.length > 100 ? offset + 100 : null });
  }
  if (path === "/admin/accounts" && request.method === "POST") {
    const parsed = creation.safeParse(JSON.parse(await readBody(request, 10_000)));
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const value = parsed.data;
    const result = await env.DB.prepare("INSERT OR IGNORE INTO accounts(uid,email,points,monthly,renews_at,note,updated_at) VALUES(?,?,?,?,?,?,?)")
      .bind(value.uid, value.email, value.points, value.monthly, nextRenewal(nowSeconds()), value.note, new Date().toISOString()).run();
    if (!result.meta.changes) throw new HttpError(409, "account_exists");
    return Response.json(await account(env.DB, value.uid), { status: 201 });
  }
  if (path.startsWith("/admin/accounts/") && request.method === "GET") {
    const uid = decodeURIComponent(path.slice("/admin/accounts/".length));
    const result = await account(env.DB, uid);
    if (!result) throw new HttpError(404, "not_found");
    return Response.json(result);
  }
  if (path.startsWith("/admin/accounts/") && request.method === "PATCH") {
    const uid = decodeURIComponent(path.slice("/admin/accounts/".length));
    const parsed = adjustment.safeParse(JSON.parse(await readBody(request, 10_000)));
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const value = parsed.data;
    const result = await env.DB.prepare(`UPDATE accounts SET points=points+?,
      renews_at=CASE WHEN monthly=0 AND ?>0 THEN ? ELSE renews_at END,
      monthly=COALESCE(?,monthly),note=COALESCE(?,note),updated_at=? WHERE uid=?`)
      .bind(value.addPoints ?? 0, value.monthly ?? null, nextRenewal(nowSeconds()), value.monthly ?? null, value.note ?? null, new Date().toISOString(), uid).run();
    if (!result.meta.changes) throw new HttpError(404, "not_found");
    return Response.json(await account(env.DB, uid));
  }
  if (path === "/admin/usage" && request.method === "GET") {
    const url = new URL(request.url), offset = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, "invalid_input");
    const since = nowSeconds() - 2_592_000;
    const [entries, totals, users] = await Promise.all([
      env.DB.prepare(`SELECT u.id,u.uid,a.email,u.model,u.points,u.input,u.cached,u.output,u.created_at,u.credits,u.status
        FROM usage_log u LEFT JOIN accounts a ON a.uid=u.uid ORDER BY u.created_at DESC,u.id LIMIT 51 OFFSET ?`).bind(offset).all(),
      // Money is per model, so the running totals stay split by model and the
      // client applies the published rate for each one.
      env.DB.prepare(`SELECT model,COUNT(*) AS runs,COALESCE(SUM(input),0) AS input,
        COALESCE(SUM(cached),0) AS cached,COALESCE(SUM(output),0) AS output,
        SUM(credits) AS credits
        FROM usage_log WHERE created_at>? GROUP BY model ORDER BY model`).bind(since).all(),
      // Per person, still split by model: cost is a model rate times tokens, and
      // one account's runs are usually spread across more than one model.
      env.DB.prepare(`SELECT u.uid,a.email,u.model,COUNT(*) AS runs,
        COALESCE(SUM(u.input),0) AS input,COALESCE(SUM(u.cached),0) AS cached,
        COALESCE(SUM(u.output),0) AS output,COALESCE(SUM(u.credits),0) AS credits,
        COALESCE(SUM(u.points),0) AS points
        FROM usage_log u LEFT JOIN accounts a ON a.uid=u.uid
        WHERE u.created_at>? GROUP BY u.uid,u.model ORDER BY credits DESC,u.uid LIMIT 200`).bind(since).all(),
    ]);
    return Response.json({
      entries: entries.results.slice(0, 50),
      nextOffset: entries.results.length > 50 ? offset + 50 : null,
      models: totals.results,
      users: users.results,
    });
  }
  if (path === "/admin/settings" && request.method === "GET") {
    const rows = await env.DB
      .prepare(
        "SELECT key,value FROM settings WHERE key IN ('free_trial','trial_points','default_initial','default_monthly')",
      )
      .all<{ key: string; value: string }>();
    const values = Object.fromEntries(
      rows.results.map((entry) => [entry.key, entry.value]),
    );
    return Response.json({
      freeTrial: values.free_trial === "true",
      trialPoints: Number(values.trial_points),
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
    if (parsed.data.trialPoints !== undefined)
      entries.push(["trial_points", parsed.data.trialPoints]);
    if (parsed.data.defaultInitial !== undefined)
      entries.push(["default_initial", parsed.data.defaultInitial]);
    if (parsed.data.defaultMonthly !== undefined)
      entries.push(["default_monthly", parsed.data.defaultMonthly]);
    await env.DB.batch(
      entries.map(([key, value]) =>
        env.DB
          .prepare("UPDATE settings SET value=? WHERE key=?")
          .bind(String(value), key),
      ),
    );
    return Response.json(parsed.data);
  }
  throw new HttpError(404, "not_found");
}
