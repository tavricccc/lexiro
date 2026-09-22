import type { D1Database } from "@cloudflare/workers-types";
import type { AdminUsageEntry } from "@lexiro/ai-contract";
import { nowSeconds } from "./billing";
import { encodeCursor, readCursor, usageCursor } from "./pagination";

/** Keyset pages and indexed 30-day aggregates; unknown costs remain separate. */
export async function adminUsage(request: Request, db: D1Database): Promise<Response> {
  const cursor = readCursor(request, usageCursor);
  const since = nowSeconds() - 2_592_000;
  const entries = db.prepare(`SELECT u.id,u.uid,a.email,u.model,u.points,u.input,u.cached,u.cache_write AS cacheWrite,
    u.output,u.created_at,u.credits,u.status,u.assessed_points AS assessedPoints,
    u.debit_verified AS debitVerified,u.usage_state AS usageState
    FROM usage_log u LEFT JOIN accounts a ON a.uid=u.uid
    ${cursor ? "WHERE (u.created_at,u.id)<(?,?)" : ""}
    ORDER BY u.created_at DESC,u.id DESC LIMIT 51`);
  const results = await db.batch<Record<string, unknown>>([
    cursor ? entries.bind(cursor.createdAt, cursor.id) : entries,
    db.prepare(`SELECT model,COUNT(*) AS runs,COALESCE(SUM(input),0) AS input,
      COALESCE(SUM(cached),0) AS cached,COALESCE(SUM(cache_write),0) AS cacheWrite,
      COALESCE(SUM(output),0) AS output,SUM(credits) AS credits
      FROM usage_log WHERE created_at>? AND usage_state='reported'
      GROUP BY model ORDER BY model`).bind(since),
    db.prepare(`SELECT u.uid,a.email,u.model,COUNT(*) AS runs,
      COALESCE(SUM(u.input),0) AS input,COALESCE(SUM(u.cached),0) AS cached,
      COALESCE(SUM(u.cache_write),0) AS cacheWrite,COALESCE(SUM(u.output),0) AS output,
      COALESCE(SUM(u.credits),0) AS credits,
      COALESCE(SUM(CASE WHEN u.debit_verified=1 THEN u.points ELSE 0 END),0) AS points
      FROM usage_log u LEFT JOIN accounts a ON a.uid=u.uid
      WHERE u.created_at>? AND u.usage_state='reported'
      GROUP BY u.uid,u.model ORDER BY credits DESC,u.uid,u.model`).bind(since),
    db.prepare(`SELECT kind,tier,COUNT(*) AS runs,COALESCE(SUM(units),0) AS units,
      COALESCE(SUM(input),0) AS input,COALESCE(SUM(cached),0) AS cached,
      COALESCE(SUM(cache_write),0) AS cacheWrite,COALESCE(SUM(output),0) AS output,
      COALESCE(SUM(credits),0) AS credits,
      COALESCE(SUM(CASE WHEN debit_verified=1 THEN points ELSE 0 END),0) AS points
      FROM usage_log WHERE created_at>? AND usage_state='reported' AND kind<>'' AND units>0
      GROUP BY kind,tier ORDER BY kind,tier`).bind(since),
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN usage_state='pending' THEN 1 ELSE 0 END),0) AS pendingUsage,
      COALESCE(SUM(CASE WHEN usage_state='unavailable' THEN 1 ELSE 0 END),0) AS unavailableUsage,
      COALESCE(SUM(CASE WHEN debit_verified=0 AND usage_state<>'pending' THEN 1 ELSE 0 END),0) AS unverifiedDebits
      FROM usage_log WHERE created_at>?`).bind(since),
  ]);
  const rows = results[0].results as unknown as AdminUsageEntry[];
  const page = rows.slice(0, 50);
  const last = page.at(-1)!;
  return Response.json({
    entries: page,
    nextCursor: rows.length > 50 ? encodeCursor({ v: 1, page: "usage", createdAt: last.created_at, id: last.id }) : null,
    models: results[1].results, users: results[2].results, kinds: results[3].results,
    ...results[4].results[0],
  });
}
