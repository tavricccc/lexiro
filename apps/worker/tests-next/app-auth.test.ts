import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import {
  APP_AUTH_CODE_TTL_MS,
  APP_AUTH_PURGE_SQL,
  issueAppAuthCode,
  redeemAppAuthCode,
} from "../src/agent/app-auth";
import { HttpError } from "../src/http";

async function fixture() {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: "app-auth-test",
          compatibilityDate: "2026-10-10",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response(\"synthetic\")}}",
              },
            },
          },
          env: { AGENT_DB: { type: "d1" } },
        },
      },
    ],
  });
  const db = await runtime.getD1Database("AGENT_DB");
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

const NOW = 1_700_000_000_000;
const TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJlLXZhbHVl";

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return Buffer.from(digest).toString("base64url");
}

const post = (path: string, body: unknown) =>
  new Request(`http://local.invalid${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

async function issue(db: Awaited<ReturnType<typeof fixture>>["db"], verifier: string) {
  const response = await issueAppAuthCode(
    post("/app-auth/codes", {
      challenge: await challengeFor(verifier),
      googleIdToken: TOKEN,
    }),
    db,
    "user-1",
    NOW,
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { code: string }).code;
}

const VERIFIER = "v".repeat(43) + "-verifier_0123456789";

async function rejects(promise: Promise<unknown>) {
  const reason = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  expect(reason).toBeInstanceOf(HttpError);
  expect((reason as HttpError).code).toBe("invalid_grant");
}

describe("app auth hand-off", () => {
  it("returns the token for the matching verifier and stores only a hash", async () => {
    const f = await fixture();
    try {
      const code = await issue(f.db, VERIFIER);
      const rows = await f.db.prepare("SELECT code_hash FROM app_auth_codes").all();
      expect(rows.results).toHaveLength(1);
      expect(rows.results[0]?.code_hash).not.toBe(code);
      const response = await redeemAppAuthCode(
        post("/app-auth/token", { code, verifier: VERIFIER }),
        f.db,
        NOW + 1000,
      );
      expect(await response.json()).toEqual({ googleIdToken: TOKEN });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("redeems a code only once", async () => {
    const f = await fixture();
    try {
      const code = await issue(f.db, VERIFIER);
      await redeemAppAuthCode(post("/app-auth/token", { code, verifier: VERIFIER }), f.db, NOW);
      await rejects(
        redeemAppAuthCode(post("/app-auth/token", { code, verifier: VERIFIER }), f.db, NOW),
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("burns the code on a wrong verifier", async () => {
    const f = await fixture();
    try {
      const code = await issue(f.db, VERIFIER);
      await rejects(
        redeemAppAuthCode(
          post("/app-auth/token", { code, verifier: "w".repeat(43) }),
          f.db,
          NOW,
        ),
      );
      await rejects(
        redeemAppAuthCode(post("/app-auth/token", { code, verifier: VERIFIER }), f.db, NOW),
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects an expired code and the cron purges it", async () => {
    const f = await fixture();
    try {
      const code = await issue(f.db, VERIFIER);
      await rejects(
        redeemAppAuthCode(
          post("/app-auth/token", { code, verifier: VERIFIER }),
          f.db,
          NOW + APP_AUTH_CODE_TTL_MS + 1,
        ),
      );
      await issue(f.db, VERIFIER);
      await f.db.prepare(APP_AUTH_PURGE_SQL).bind(NOW + APP_AUTH_CODE_TTL_MS + 1).run();
      const rows = await f.db.prepare("SELECT 1 FROM app_auth_codes").all();
      expect(rows.results).toHaveLength(0);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("refuses malformed input", async () => {
    const f = await fixture();
    try {
      await expect(
        issueAppAuthCode(
          post("/app-auth/codes", { challenge: "short", googleIdToken: TOKEN }),
          f.db,
          "user-1",
          NOW,
        ),
      ).rejects.toThrow();
      await expect(
        redeemAppAuthCode(post("/app-auth/token", { code: "x" }), f.db, NOW),
      ).rejects.toThrow();
    } finally {
      await f.runtime.dispose();
    }
  });
});
