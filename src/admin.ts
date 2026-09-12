import { z } from "zod";
import type { Env } from "./env";
import { account, nextRenewal, nowSeconds } from "./billing";
import { HttpError, readBody } from "./http";

const creation = z.strictObject({ uid: z.string().min(1).max(128), email: z.email(), points: z.number().int().min(0).max(1_000_000), monthly: z.number().int().min(0).max(1_000_000), note: z.string().max(500).default("") });
const adjustment = z.strictObject({ addPoints: z.number().int().min(-1_000_000).max(1_000_000).optional(), monthly: z.number().int().min(0).max(1_000_000).optional(), note: z.string().max(500).optional() }).refine((value) => Object.keys(value).length > 0);

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
  if (path === "/admin/settings" && request.method === "GET") {
    const trial = await env.DB.prepare("SELECT value FROM settings WHERE key='free_trial'").first<string>("value");
    return Response.json({ freeTrial: trial === "true" });
  }
  if (path === "/admin/settings" && request.method === "PATCH") {
    const parsed = z.strictObject({ freeTrial: z.boolean() }).safeParse(JSON.parse(await readBody(request, 1000)));
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='free_trial'").bind(String(parsed.data.freeTrial)).run();
    return Response.json(parsed.data);
  }
  throw new HttpError(404, "not_found");
}
