import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { testDatabase } from "./database";
import { createWorker } from "../src/index";
import { AuthenticationError } from "../src/auth";
import type { Env } from "../src/env";
import { account, reserve, settle } from "../src/billing";

let database: Awaited<ReturnType<typeof testDatabase>>, env: Env;
beforeEach(async () => {
  database = await testDatabase();
  env = {
    DB: database.db,
    FIREBASE_PROJECT_ID: "test-project",
    ADMIN_EMAILS: "admin@example.test",
    OPENAI_API_KEY: "private-test-key",
    OPENAI_BASE_URL: "https://provider.test/v1",
    ALLOWED_ORIGIN: "https://lexiro.test,http://localhost:3000",
  };
});
afterEach(async () => {
  await database.runtime.dispose();
});
const verify = vi.fn(async (request: Request) => {
  const token = request.headers.get("authorization");
  if (!token) throw new AuthenticationError();
  const admin = token === "Bearer admin";
  return {
    uid: admin ? "admin" : "u",
    email: admin ? "admin@example.test" : "u@example.test",
    emailVerified: token !== "Bearer unverified",
  };
});
const frame = (type: string, value: object) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`;
function provider(result?: object) {
  return vi.fn<typeof fetch>(async (_url, options) => {
    const body = await new Response(options!.body as BodyInit).json();
    const output = JSON.stringify(
      result ?? {
        items: [
          {
            senses: [
              { pos: null, meaningZh: "蘋果", example: "The apple is red." },
            ],
          },
        ],
      },
    );
    const response = {
      id: "resp_fixture",
      instructions: body.instructions,
      model: body.model,
      output: [{ content: [{ type: "output_text", text: output }] }],
      usage: { input_tokens: 100, output_tokens: 20 },
    };
    return new Response(
      frame("response.created", { response }) +
        frame("response.output_text.delta", { delta: output }) +
        frame("response.completed", { response }),
      { headers: { "content-type": "text/event-stream" } },
    );
  });
}
function req(
  path: string,
  body?: unknown,
  token = "user",
  method = body ? "POST" : "GET",
) {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      origin: "https://lexiro.test",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function call(request: Request, upstream = provider()) {
  const pending: Promise<unknown>[] = [];
  const context = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const response = await createWorker(verify, upstream).fetch(
    request,
    env,
    context,
  );
  const text = await response.text();
  await Promise.all(pending);
  return { response, text, upstream };
}
const generation = () => ({
  kind: "words",
  raw: "apple n. 蘋果",
  tier: "lite",
  session: crypto.randomUUID(),
});

describe("Worker HTTP boundary", () => {
  it("preserves a reservation when an administrator saves only a note", async () => {
    const hold = await reserve(env.DB, "u", [{ id: "held", limitId: "held" }], 1000);
    for (const patch of [{ note: "note only" }, { note: "form save", addPoints: 0, monthly: 1000 }]) {
      const result = await call(req("/admin/accounts/u", patch, "admin", "PATCH"));
      expect(result.response.status).toBe(200);
      expect(JSON.parse(result.text)).toMatchObject({ points: -400, note: patch.note });
    }
    await settle(env.DB, hold, [], { model: "test" }, { charged: 2, cost: 2 });
    expect((await account(env.DB, "u"))!.points).toBe(98);
  });
  it("rejects financial changes during generation without modifying the account", async () => {
    const hold = await reserve(env.DB, "u", [{ id: "held", limitId: "held" }], 1000);
    for (const patch of [{ addPoints: 10 }, { addPoints: -10 }, { monthly: 200 }, { monthly: 0 }]) {
      const result = await call(req("/admin/accounts/u", patch, "admin", "PATCH"));
      expect(result.response.status).toBe(409);
      expect((await account(env.DB, "u"))!.points).toBe(-400);
      expect((await account(env.DB, "u"))!.monthly).toBe(1000);
    }
    await settle(env.DB, hold, hold.charges, { model: "test" });
    expect((await call(req("/admin/accounts/u", { addPoints: 10 }, "admin", "PATCH"))).response.status).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(110);
  });

  it("accepts one bounded WebP and settles its actual provider cost", async () => {
    const bytes = new Uint8Array(30),
      view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode("RIFF"));
    view.setUint32(4, 22, true);
    bytes.set(new TextEncoder().encode("WEBPVP8 "), 8);
    view.setUint32(16, 10, true);
    bytes.set([0x9d, 1, 0x2a], 23);
    view.setUint16(26, 100, true);
    view.setUint16(28, 100, true);
    const result = await call(
      new Request("https://worker.test/organize", {
        method: "POST",
        headers: {
          authorization: "Bearer user",
          "content-type": "text/plain",
          "x-session-id": crypto.randomUUID(),
        },
        body: btoa(String.fromCharCode(...bytes)),
      }),
      provider({ lines: ["apple 蘋果"] }),
    );
    expect(result.response.status).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(99);
  });
  it("rebuilds an owned but provider-expired cursor without charging twice", async () => {
    await env.DB.prepare("INSERT INTO cursors VALUES(?,?,?)")
      .bind("resp_expired", "u", Math.floor(Date.now() / 1000))
      .run();
    const upstream = provider();
    upstream.mockImplementationOnce(async () =>
      Response.json(
        {
          error: {
            param: "previous_response_id",
            message: "private diagnostic",
          },
        },
        { status: 400 },
      ),
    );
    const result = await call(
      req("/generate", { ...generation(), cursor: "resp_expired" }),
      upstream,
    );
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(result.response.headers.get("x-context-rebuilt")).toBe("1");
    expect(result.text).not.toContain("private diagnostic");
    expect((await account(env.DB, "u"))!.points).toBe(99);
  });
  it("forces text organization to Lite and settles its actual provider cost", async () => {
    const result = await call(
      req("/organize", {
        kind: "organizeText",
        raw: "1. apple 蘋果",
        tier: "pro",
        session: crypto.randomUUID(),
      }),
      provider({ lines: ["apple 蘋果"] }),
    );
    expect(result.response.status).toBe(200);
    expect(result.text).toContain("apple 蘋果");
    expect((await account(env.DB, "u"))!.points).toBe(99);
  });
  it("returns account points without keys or model configuration", async () => {
    const result = await call(req("/me"));
    expect(JSON.parse(result.text)).toMatchObject({ points: 100, admin: false });
    expect(result.text).not.toContain("private-test-key");
    expect(result.text).not.toContain("tiers");
  });
  it("forbids every origin outside the configured list", async () => {
    const denied = await call(
      new Request("https://worker.test/me", {
        headers: { origin: "https://attacker.test" },
      }),
    );
    expect(denied.response.status).toBe(403);
    expect(denied.response.headers.has("access-control-allow-origin")).toBe(
      false,
    );
    const unlisted = await call(
      new Request("https://worker.test/me", {
        headers: { origin: "http://localhost:9999" },
      }),
    );
    expect(unlisted.response.status).toBe(403);
    const allowed = await call(
      new Request("https://worker.test/me", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(allowed.response.status).toBe(204);
    expect(allowed.response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });
  it("does not expose admin routes to regular users", async () => {
    expect((await call(req("/admin/accounts"))).response.status).toBe(404);
    const result = await call(req("/admin/accounts", undefined, "admin"));
    expect(JSON.parse(result.text).accounts).toHaveLength(1);
  });
  it("hands over the first period when an allowance is granted", async () => {
    await env.DB.prepare("UPDATE accounts SET points=40,monthly=0 WHERE uid='u'").run();
    const granted = await call(
      req("/admin/accounts/u", { monthly: 500 }, "admin", "PATCH"),
    );
    // Not 40 and a wait until the nightly renewal: the plan starts now.
    expect(JSON.parse(granted.text)).toMatchObject({ points: 500, monthly: 500 });
    // Saving the same allowance again is not another month's points.
    const resaved = await call(
      req("/admin/accounts/u", { monthly: 500, addPoints: -100 }, "admin", "PATCH"),
    );
    expect(JSON.parse(resaved.text)).toMatchObject({ points: 400 });
  });
  it("takes points away without letting the balance go below zero", async () => {
    const emptied = await call(
      req("/admin/accounts/u", { addPoints: -1000 }, "admin", "PATCH"),
    );
    expect(JSON.parse(emptied.text)).toMatchObject({ points: 0 });
  });
  it("allows verified admins to update points and the trial switch", async () => {
    const changed = await call(
      req("/admin/accounts/u", { addPoints: 20, monthly: 0 }, "admin", "PATCH"),
    );
    expect(JSON.parse(changed.text)).toMatchObject({ points: 120, monthly: 0 });
    expect(
      (
        await call(
          req("/admin/settings", { freeTrial: true }, "admin", "PATCH"),
        )
      ).response.status,
    ).toBe(200);
    expect(
      JSON.parse((await call(req("/admin/settings", undefined, "admin"))).text),
    ).toEqual({
      freeTrial: true,
      defaultInitial: 1000,
      defaultMonthly: 1000,
    });
    expect(
      (await call(req("/admin/accounts/u", { admin: true }, "admin", "PATCH")))
        .response.status,
    ).toBe(400);
  });
  it("charges before generation and keeps the prompt/key out of returned stream", async () => {
    const body = generation();
    const result = await call(req("/generate", body));
    expect(result.response.status).toBe(200);
    expect(result.text).toContain("The apple is red.");
    expect(result.text).not.toContain("資料邊界");
    expect(result.text).not.toContain("private-test-key");
    expect((await account(env.DB, "u"))!.points).toBe(99);
    const again = await call(req("/generate", body));
    expect(again.response.status).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(99);
  });
  it("never charges an administrator but still records the tokens spent", async () => {
    const result = await call(req("/generate", generation(), "admin"));
    expect(result.response.status).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(100);
    const usage = await call(req("/admin/usage", undefined, "admin"));
    expect(JSON.parse(usage.text)).toMatchObject({
      entries: [{ uid: "admin", model: "gpt-5.6-luna", points: 0, credits: 1, input: 100, output: 20, status: "complete" }],
      models: [{ model: "gpt-5.6-luna", runs: 1, credits: 1, input: 100, output: 20 }],
      // What that one account cost, separately from what it was charged.
      users: [{ uid: "admin", email: "admin@example.test", model: "gpt-5.6-luna", runs: 1, credits: 1, points: 0 }],
      // Cost against billable units, which is what the point rates are set from.
      kinds: [{ kind: "words", tier: "lite", runs: 1, units: 1, credits: 1 }],
    });
  });
  it("runs a batch the balance cannot cover and leaves the account at zero", async () => {
    await env.DB.prepare("UPDATE accounts SET points=1 WHERE uid='u'").run();
    const result = await call(req("/generate", generation()));
    expect(result.response.status).toBe(200);
    expect(result.text).toContain("The apple is red.");
    expect((await account(env.DB, "u"))!.points).toBe(0);
    const refused = await call(req("/generate", generation()));
    expect(refused.response.status).toBe(402);
    expect(JSON.parse(refused.text).error.code).toBe("insufficient_points");
  });
  it("rebuilds a foreign cursor and refuses client model/prompt overrides", async () => {
    const body = { ...generation(), cursor: "resp_someone_else" };
    const upstream = provider();
    const result = await call(req("/generate", body), upstream);
    expect(result.response.headers.get("x-context-rebuilt")).toBe("1");
    expect(
      JSON.parse(String(upstream.mock.calls[0][1]!.body)).previous_response_id,
    ).toBeUndefined();
    const invalid = await call(
      req("/generate", {
        ...generation(),
        model: "anything",
        instructions: "steal",
      }),
    );
    expect(invalid.response.status).toBe(400);
    expect(invalid.upstream).not.toHaveBeenCalled();
  });
  it("refunds on upstream failure without exposing its body", async () => {
    const upstream = vi.fn<typeof fetch>(
      async () =>
        new Response("private key and prompt diagnostics", { status: 503 }),
    );
    const result = await call(req("/generate", generation()), upstream);
    expect(result.response.status).toBe(503);
    expect(JSON.parse(result.text)).toEqual({
      error: { code: "upstream_unavailable" },
    });
    expect((await account(env.DB, "u"))!.points).toBe(100);
  });
  it("enforces input/source limits before charging or calling the provider", async () => {
    for (const raw of [
      "a".repeat(5001),
      "a".repeat(201),
      Array.from({ length: 31 }, (_, i) => `word${i}`).join("\n"),
    ]) {
      const result = await call(req("/generate", { ...generation(), raw }));
      expect(result.response.status).toBe(413);
      expect(result.upstream).not.toHaveBeenCalled();
    }
    expect((await account(env.DB, "u"))!.points).toBe(100);
  });
});
