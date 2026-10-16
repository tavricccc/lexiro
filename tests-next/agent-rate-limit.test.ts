import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  rateLimitKey,
  RATE_LIMIT_AUTHORIZE_MAX,
  RATE_LIMIT_PURGE_SQL,
  RATE_LIMIT_RETENTION_MS,
  RATE_LIMIT_WINDOW_MS,
} from "../src/agent/rate-limit";
import { HttpError } from "../src/http";

async function fixture(migrate = true) {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: "agent-rate-limit-test",
          compatibilityDate: "2026-10-10",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response('synthetic')}}",
              },
            },
          },
          env: { AGENT_DB: { type: "d1" } },
        },
      },
    ],
  });
  const db = await runtime.getD1Database("AGENT_DB");
  if (migrate)
    for (const file of (
      await readdir(new URL("../agent-migrations/", import.meta.url))
    )
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(
        new URL(`../agent-migrations/${file}`, import.meta.url),
        "utf8",
      );
      await db.batch(
        sql
          .split(";")
          .map((statement) => statement.trim())
          .filter(Boolean)
          .map((statement) => db.prepare(statement)),
      );
    }
  return { runtime, db };
}

// A fixed instant aligned to the 60 second window boundary.
const WINDOW = 1_700_000_040_000;
const windowStart = (now: number) =>
  Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
function request(ip?: string) {
  return new Request("http://local.invalid/authorize", {
    headers: ip ? { "CF-Connecting-IP": ip } : {},
  });
}

describe("agent rate limiting", () => {
  it("increments a single row for the same key and window", async () => {
    const f = await fixture();
    try {
      for (let call = 0; call < 3; call++)
        await checkRateLimit(f.db, "authorize", request("203.0.113.7"), WINDOW);
      const rows = await f.db
        .prepare("SELECT key,window_start,count FROM agent_rate_limits")
        .all();
      expect(rows.results).toHaveLength(1);
      expect(rows.results[0]).toMatchObject({
        key: rateLimitKey("authorize", "203.0.113.7"),
        window_start: WINDOW,
        count: 3,
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("returns 429 with a bounded Retry-After once the window limit is exceeded", async () => {
    const f = await fixture();
    try {
      const ip = "198.51.100.1";
      for (let call = 0; call < RATE_LIMIT_AUTHORIZE_MAX; call++)
        await checkRateLimit(f.db, "authorize", request(ip), WINDOW);
      const error = await checkRateLimit(
        f.db,
        "authorize",
        request(ip),
        WINDOW,
      ).then(
        () => null,
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(HttpError);
      const httpError = error as HttpError;
      expect(httpError.status).toBe(429);
      expect(httpError.code).toBe("rate_limited");
      const retryAfter = Number(httpError.retryAfter);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS / 1000);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("starts a fresh count when now moves to the next window", async () => {
    const f = await fixture();
    try {
      const ip = "203.0.113.9";
      await checkRateLimit(f.db, "authorize", request(ip), WINDOW);
      await checkRateLimit(f.db, "authorize", request(ip), WINDOW);
      await checkRateLimit(
        f.db,
        "authorize",
        request(ip),
        WINDOW + RATE_LIMIT_WINDOW_MS,
      );
      const rows = await f.db
        .prepare(
          "SELECT window_start,count FROM agent_rate_limits WHERE key=? ORDER BY window_start",
        )
        .bind(rateLimitKey("authorize", ip))
        .all();
      expect(rows.results).toEqual([
        { window_start: windowStart(WINDOW), count: 2 },
        {
          window_start: windowStart(WINDOW) + RATE_LIMIT_WINDOW_MS,
          count: 1,
        },
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("keeps different IPs and different endpoints in separate counters", async () => {
    const f = await fixture();
    try {
      await checkRateLimit(f.db, "authorize", request("203.0.113.1"), WINDOW);
      await checkRateLimit(f.db, "authorize", request("203.0.113.1"), WINDOW);
      await checkRateLimit(f.db, "authorize", request("203.0.113.2"), WINDOW);
      await checkRateLimit(
        f.db,
        "oauth_register",
        request("203.0.113.1"),
        WINDOW,
      );
      const rows = await f.db
        .prepare("SELECT key,count FROM agent_rate_limits ORDER BY key")
        .all();
      expect(rows.results).toEqual([
        { key: "authorize:203.0.113.1", count: 2 },
        { key: "authorize:203.0.113.2", count: 1 },
        { key: "oauth_register:203.0.113.1", count: 1 },
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("falls back to the unknown key when CF-Connecting-IP is missing", async () => {
    const f = await fixture();
    try {
      await checkRateLimit(f.db, "authorize", request(), WINDOW);
      await checkRateLimit(f.db, "authorize", request(), WINDOW);
      const rows = await f.db
        .prepare("SELECT key,count FROM agent_rate_limits")
        .all();
      expect(rows.results).toEqual([{ key: "authorize:unknown", count: 2 }]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("fails open when the D1 counter table is unavailable", async () => {
    const f = await fixture(false);
    try {
      await expect(
        checkRateLimit(f.db, "authorize", request("203.0.113.5"), WINDOW),
      ).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("purges windows older than the retention cutoff and keeps fresh rows", async () => {
    const f = await fixture();
    try {
      const freshKey = rateLimitKey("authorize", "203.0.113.3");
      const staleKey = rateLimitKey("authorize", "203.0.113.4");
      await checkRateLimit(f.db, "authorize", request("203.0.113.3"), WINDOW);
      await f.db
        .prepare(
          "INSERT INTO agent_rate_limits(key,window_start,count) VALUES(?,?,1)",
        )
        .bind(staleKey, WINDOW - RATE_LIMIT_RETENTION_MS - RATE_LIMIT_WINDOW_MS)
        .run();
      await f.db.batch([
        f.db.prepare(RATE_LIMIT_PURGE_SQL).bind(WINDOW - RATE_LIMIT_RETENTION_MS),
      ]);
      const rows = await f.db
        .prepare("SELECT key,window_start FROM agent_rate_limits")
        .all();
      expect(rows.results).toEqual([
        { key: freshKey, window_start: WINDOW },
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });
});
