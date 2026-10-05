import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LIMITS, type AdminSettingsValue } from "@lexiro/ai-contract";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { testDatabase } from "./database";
import { createWorker } from "../src/index";
import { AuthenticationError } from "../src/auth";
import type { Env } from "../src/env";
import { account, ensureAccount, reserve, settle } from "../src/billing";

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
function provider(
  result?: object,
  capture?: (request: unknown) => void,
  usage = { input_tokens: 100, output_tokens: 20 },
) {
  return vi.fn<typeof fetch>(async (_url, options) => {
    const body = await new Response(options!.body as BodyInit).json();
    capture?.(body);
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
      usage,
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
  const payload =
    (path === "/generate" || path === "/organize") &&
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body)
      ? { model: "gpt-6-luna", ...body }
      : body;
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      origin: "https://lexiro.test",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(payload) } : {}),
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
async function expectedAccount() {
  const current = (await account(env.DB, "u"))!;
  const { points, monthly, renews_at, note, version } = current;
  return { points, monthly, renews_at, note, version };
}
async function expectedSettings() {
  return JSON.parse(
    (await call(req("/admin/settings", undefined, "admin"))).text,
  ) as AdminSettingsValue;
}
const generation = () => ({
  kind: "words",
  raw: "apple n. 蘋果",
  tier: "lite",
  session: crypto.randomUUID(),
});

describe("Worker HTTP boundary", () => {
  it.each([
    ["gpt-5.6-luna", 11],
    ["gpt-6-luna", 5],
  ] as const)(
    "routes %s and settles its own reported token cost",
    async (model, credits) => {
      const upstream = provider(
        undefined,
        (request) =>
          expect(request).toMatchObject({
            model,
            reasoning: { effort: "low" },
          }),
        { input_tokens: 1000, output_tokens: 1000 },
      );
      const result = await call(
        req("/generate", { ...generation(), model }),
        upstream,
      );
      expect(result.response.status).toBe(200);
      expect(
        await env.DB.prepare(
          "SELECT model,credits,points FROM usage_log",
        ).first(),
      ).toEqual({ model, credits, points: credits });
      expect((await account(env.DB, "u"))!.points).toBe(100 - credits);
    },
  );
  it("persists missing usage and reconciles it on the next account request", async () => {
    const output = JSON.stringify({
      items: [
        {
          senses: [
            { pos: "n.", meaningZh: "蘋果", example: "I ate an apple." },
          ],
        },
      ],
    });
    const response = {
      id: "resp_pending",
      status: "completed",
      output: [{ content: [{ type: "output_text", text: output }] }],
    };
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          frame("response.created", { response }) +
            frame("response.output_text.delta", { delta: output }) +
            frame("response.completed", { response }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const first = await call(req("/generate", generation()), upstream);
    expect(first.response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(
      await env.DB.prepare("SELECT credits,usage_state FROM usage_log").first(),
    ).toEqual({ credits: null, usage_state: "pending" });
    const recovered = vi.fn<typeof fetch>(async () =>
      Response.json({
        ...response,
        usage: { input_tokens: 900, output_tokens: 60 },
      }),
    );
    const me = await call(req("/me"), recovered);
    expect(JSON.parse(me.text).points).toBe(99);
    expect(
      await env.DB.prepare(
        "SELECT credits,points,usage_state FROM usage_log",
      ).first(),
    ).toEqual({ credits: 1, points: 1, usage_state: "reported" });
    expect(recovered).toHaveBeenCalledOnce();
  });
  it("preserves a reservation when an administrator saves only a note", async () => {
    const hold = await reserve(
      env.DB,
      "u",
      [{ id: "held", limitId: "held" }],
      1000,
    );
    for (const patch of [
      { note: "note only" },
      { note: "form save", addPoints: 0, monthly: 1000 },
    ]) {
      const result = await call(
        req(
          "/admin/accounts/u",
          { ...patch, expected: await expectedAccount() },
          "admin",
          "PATCH",
        ),
      );
      expect(result.response.status).toBe(200);
      expect(JSON.parse(result.text)).toMatchObject({
        points: -400,
        note: patch.note,
      });
    }
    await settle(env.DB, hold, [], { model: "test" }, { charged: 2, cost: 2 });
    expect((await account(env.DB, "u"))!.points).toBe(98);
  });
  it("rejects financial changes during generation without modifying the account", async () => {
    const hold = await reserve(
      env.DB,
      "u",
      [{ id: "held", limitId: "held" }],
      1000,
    );
    for (const patch of [
      { addPoints: 10 },
      { addPoints: -10 },
      { monthly: 200 },
      { monthly: 0 },
    ]) {
      const result = await call(
        req(
          "/admin/accounts/u",
          { ...patch, expected: await expectedAccount() },
          "admin",
          "PATCH",
        ),
      );
      expect(result.response.status).toBe(409);
      expect((await account(env.DB, "u"))!.points).toBe(-400);
      expect((await account(env.DB, "u"))!.monthly).toBe(1000);
    }
    await settle(env.DB, hold, hold.charges, { model: "test" });
    expect(
      (
        await call(
          req(
            "/admin/accounts/u",
            { addPoints: 10, expected: await expectedAccount() },
            "admin",
            "PATCH",
          ),
        )
      ).response.status,
    ).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(110);
  });

  it.each(["count", "bytes"] as const)(
    "rejects oversized photo %s before reserving points or contacting the provider",
    async (limit) => {
      const result = await call(
        new Request("https://worker.test/organize", {
          method: "POST",
          headers: {
            authorization: "Bearer user",
            "content-type": "text/plain",
            "x-session-id": crypto.randomUUID(),
            "x-ai-model": "gpt-6-luna",
            ...(limit === "bytes"
              ? { "content-length": String(LIMITS.bodyBytes + 1) }
              : {}),
          },
          body: limit === "count" ? Array(11).fill("AAAA").join("\n") : "AAAA",
        }),
      );
      expect(result.response.status).toBe(413);
      expect(result.upstream).not.toHaveBeenCalled();
      expect((await account(env.DB, "u"))!.points).toBe(100);
      expect(
        (await env.DB.prepare("SELECT * FROM charges").all()).results,
      ).toEqual([]);
    },
  );

  it.each([1, 10])(
    "accepts %i photos in one provider request and keeps every successful charge identity",
    async (count) => {
      const bytes = new Uint8Array(30),
        view = new DataView(bytes.buffer);
      bytes.set(new TextEncoder().encode("RIFF"));
      view.setUint32(4, 22, true);
      bytes.set(new TextEncoder().encode("WEBPVP8 "), 8);
      view.setUint32(16, 10, true);
      bytes.set([0x9d, 1, 0x2a], 23);
      view.setUint16(26, 100, true);
      view.setUint16(28, 100, true);
      const images = Array.from({ length: count }, (_, index) => {
        view.setUint16(26, 100 + index, true);
        return btoa(String.fromCharCode(...bytes));
      });
      const session = crypto.randomUUID();
      const request = () =>
        new Request("https://worker.test/organize", {
          method: "POST",
          headers: {
            authorization: "Bearer user",
            "content-type": "text/plain",
            "x-session-id": session,
            "x-ai-model": "gpt-6-luna",
          },
          body: images.join("\n"),
        });
      const capture = vi.fn();
      const upstream = provider({ lines: ["apple 蘋果"] }, capture);
      const result = await call(request(), upstream);
      expect(result.response.status).toBe(200);
      expect(upstream).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          input: [
            expect.anything(),
            {
              role: "user",
              content: [
                expect.objectContaining({ type: "input_text" }),
                ...images.map((image) => ({
                  type: "input_image",
                  image_url: `data:image/webp;base64,${image}`,
                  detail: "high",
                })),
              ],
            },
          ],
        }),
      );
      expect((await account(env.DB, "u"))!.points).toBe(99);
      expect(
        await env.DB.prepare("SELECT points,units FROM usage_log").first(),
      ).toEqual({ points: 1, units: count });
      expect(
        (
          await env.DB.prepare(
            "SELECT id FROM charges WHERE attempt_id LIKE 'settled:%'",
          ).all()
        ).results,
      ).toHaveLength(count);
      expect(
        (await call(request(), provider({ lines: ["apple 蘋果"] }))).response
          .status,
      ).toBe(200);
      expect((await account(env.DB, "u"))!.points).toBe(99);
    },
  );
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
  it("routes Pro text organization to Sol/low and settles its actual provider cost", async () => {
    const upstream = provider({ lines: ["apple 蘋果"] });
    const result = await call(
      req("/organize", {
        kind: "organizeText",
        raw: "1. apple 蘋果",
        tier: "pro",
        session: crypto.randomUUID(),
      }),
      upstream,
    );
    expect(result.response.status).toBe(200);
    expect(result.text).toContain("apple 蘋果");
    expect(JSON.parse(upstream.mock.calls[0][1]!.body as string)).toMatchObject({ model: "gpt-6.1-sol", reasoning: { effort: "low" } });
    expect((await account(env.DB, "u"))!.points).toBe(97);
  });
  it("returns account points without keys or model configuration", async () => {
    const result = await call(req("/me"));
    expect(JSON.parse(result.text)).toMatchObject({
      points: 100,
      admin: false,
    });
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
    expect(allowed.response.headers.get("access-control-allow-headers")).toContain("X-AI-Tier");
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
    await env.DB.prepare(
      "UPDATE accounts SET points=40,monthly=0 WHERE uid='u'",
    ).run();
    const granted = await call(
      req(
        "/admin/accounts/u",
        { monthly: 500, expected: await expectedAccount() },
        "admin",
        "PATCH",
      ),
    );
    // Not 40 and a wait until the nightly renewal: the plan starts now.
    expect(JSON.parse(granted.text)).toMatchObject({
      points: 500,
      monthly: 500,
    });
    // Saving the same allowance again is not another month's points.
    const resaved = await call(
      req(
        "/admin/accounts/u",
        { monthly: 500, addPoints: -100, expected: await expectedAccount() },
        "admin",
        "PATCH",
      ),
    );
    expect(JSON.parse(resaved.text)).toMatchObject({ points: 400 });
  });
  it("takes points away without letting the balance go below zero", async () => {
    const emptied = await call(
      req(
        "/admin/accounts/u",
        { addPoints: -1000, expected: await expectedAccount() },
        "admin",
        "PATCH",
      ),
    );
    expect(JSON.parse(emptied.text)).toMatchObject({ points: 0 });
  });
  it("allows verified admins to update points and the trial switch", async () => {
    const changed = await call(
      req(
        "/admin/accounts/u",
        { addPoints: 20, monthly: 0, expected: await expectedAccount() },
        "admin",
        "PATCH",
      ),
    );
    expect(JSON.parse(changed.text)).toMatchObject({ points: 120, monthly: 0 });
    const savedSettings = await call(
      req(
        "/admin/settings",
        { freeTrial: true, expected: await expectedSettings() },
        "admin",
        "PATCH",
      ),
    );
    expect(savedSettings.response.status).toBe(200);
    expect(JSON.parse(savedSettings.text)).toEqual({
      version: 1,
      freeTrial: true,
      defaultInitial: 1000,
      defaultMonthly: 1000,
    });
    expect(
      JSON.parse((await call(req("/admin/settings", undefined, "admin"))).text),
    ).toEqual({
      version: 1,
      freeTrial: true,
      defaultInitial: 1000,
      defaultMonthly: 1000,
    });
    expect(
      (
        await call(
          req(
            "/admin/accounts/u",
            { admin: true, expected: await expectedAccount() },
            "admin",
            "PATCH",
          ),
        )
      ).response.status,
    ).toBe(400);
  });
  it("rejects stale and repeated financial adjustments without changing the stored account", async () => {
    const expected = await expectedAccount();
    const payload = { addPoints: 20, expected };
    const saved = await call(
      req("/admin/accounts/u", payload, "admin", "PATCH"),
    );
    expect(JSON.parse(saved.text)).toEqual(await account(env.DB, "u"));
    const replay = await call(
      req("/admin/accounts/u", payload, "admin", "PATCH"),
    );
    expect(replay.response.status).toBe(409);
    expect(JSON.parse(replay.text)).toEqual({
      error: { code: "stale_account" },
    });
    expect((await account(env.DB, "u"))!.points).toBe(expected.points + 20);
    const restored = await call(
      req(
        "/admin/accounts/u",
        { addPoints: -20, expected: await expectedAccount() },
        "admin",
        "PATCH",
      ),
    );
    expect(restored.response.status).toBe(200);
    expect((await account(env.DB, "u"))!.points).toBe(expected.points);
    const oldAfterRestoring = await call(
      req("/admin/accounts/u", payload, "admin", "PATCH"),
    );
    expect(oldAfterRestoring.response.status).toBe(409);
    expect((await account(env.DB, "u"))!.points).toBe(expected.points);
    const staleNote = await call(
      req(
        "/admin/accounts/u",
        { note: "old edit", expected },
        "admin",
        "PATCH",
      ),
    );
    expect(staleNote.response.status).toBe(409);
    expect((await account(env.DB, "u"))!.note).toBeNull();
    const concurrentExpected = await expectedAccount();
    const concurrent = await Promise.all([
      call(
        req(
          "/admin/accounts/u",
          { addPoints: 5, expected: concurrentExpected },
          "admin",
          "PATCH",
        ),
      ),
      call(
        req(
          "/admin/accounts/u",
          { addPoints: 5, expected: concurrentExpected },
          "admin",
          "PATCH",
        ),
      ),
    ]);
    expect(concurrent.map((result) => result.response.status).sort()).toEqual([
      200, 409,
    ]);
    expect((await account(env.DB, "u"))!.points).toBe(
      concurrentExpected.points + 5,
    );
  });
  it("turns off new-account trial defaults without removing existing account credit or allowance", async () => {
    await env.DB.prepare(
      "UPDATE settings SET value='true' WHERE key='free_trial'",
    ).run();
    await env.DB.prepare(
      "UPDATE accounts SET points=72,monthly=300 WHERE uid='u'",
    ).run();
    const saved = await call(
      req(
        "/admin/settings",
        {
          freeTrial: false,
          defaultInitial: 30,
          expected: await expectedSettings(),
        },
        "admin",
        "PATCH",
      ),
    );
    expect(JSON.parse(saved.text)).toEqual({
      version: 1,
      freeTrial: false,
      defaultInitial: 30,
      defaultMonthly: 1000,
    });
    expect(
      JSON.parse((await call(req("/admin/settings", undefined, "admin"))).text),
    ).toEqual(JSON.parse(saved.text));
    expect(await account(env.DB, "u")).toMatchObject({
      points: 72,
      monthly: 300,
    });
    await ensureAccount(env.DB, "new-account", "new@example.test");
    expect(await account(env.DB, "new-account")).toMatchObject({
      points: 0,
      monthly: 0,
    });
  });
  it("applies all settings from one reviewed snapshot and rejects stale multi-field writes atomically", async () => {
    const expected = await expectedSettings();
    const saved = await call(
      req(
        "/admin/settings",
        { freeTrial: true, defaultInitial: 55, defaultMonthly: 65, expected },
        "admin",
        "PATCH",
      ),
    );
    expect(saved.response.status).toBe(200);
    expect(JSON.parse(saved.text)).toEqual({
      version: 1,
      freeTrial: true,
      defaultInitial: 55,
      defaultMonthly: 65,
    });
    const stale = await call(
      req(
        "/admin/settings",
        { freeTrial: false, defaultInitial: 0, defaultMonthly: 0, expected },
        "admin",
        "PATCH",
      ),
    );
    expect(stale.response.status).toBe(409);
    expect(JSON.parse(stale.text)).toEqual({
      error: { code: "stale_settings" },
    });
    expect(await expectedSettings()).toEqual(JSON.parse(saved.text));
    const restored = await call(
      req(
        "/admin/settings",
        {
          freeTrial: expected.freeTrial,
          defaultInitial: expected.defaultInitial,
          defaultMonthly: expected.defaultMonthly,
          expected: await expectedSettings(),
        },
        "admin",
        "PATCH",
      ),
    );
    expect(restored.response.status).toBe(200);
    expect(await expectedSettings()).toEqual({ ...expected, version: 2 });
    const oldAfterRestoring = await call(
      req(
        "/admin/settings",
        { freeTrial: true, defaultInitial: 55, defaultMonthly: 65, expected },
        "admin",
        "PATCH",
      ),
    );
    expect(oldAfterRestoring.response.status).toBe(409);
    expect(await expectedSettings()).toEqual({ ...expected, version: 2 });
    const concurrentExpected = await expectedSettings();
    const concurrent = await Promise.all([
      call(
        req(
          "/admin/settings",
          { defaultInitial: 77, expected: concurrentExpected },
          "admin",
          "PATCH",
        ),
      ),
      call(
        req(
          "/admin/settings",
          { defaultInitial: 88, expected: concurrentExpected },
          "admin",
          "PATCH",
        ),
      ),
    ]);
    expect(concurrent.map((result) => result.response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await expectedSettings()).toEqual(
      JSON.parse(
        concurrent.find((result) => result.response.status === 200)!.text,
      ),
    );
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
      entries: [
        {
          uid: "admin",
          model: "gpt-6-luna",
          points: 0,
          credits: 1,
          input: 100,
          output: 20,
          status: "complete",
        },
      ],
      models: [
        { model: "gpt-6-luna", runs: 1, credits: 1, input: 100, output: 20 },
      ],
      // What that one account cost, separately from what it was charged.
      users: [
        {
          uid: "admin",
          email: "admin@example.test",
          model: "gpt-6-luna",
          runs: 1,
          credits: 1,
          points: 0,
        },
      ],
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
    expect(
      await env.DB.prepare(
        "SELECT credits,points,usage_state,status FROM usage_log",
      ).first(),
    ).toEqual({
      credits: null,
      points: 0,
      usage_state: "unavailable",
      status: "failed",
    });
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
