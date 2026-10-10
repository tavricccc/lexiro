import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { WebSocketServer } from "ws";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { prepareGeneration, upstreamRequest } from "../src/generation";
import { ProviderWebSocket, TransportError } from "../src/provider-websocket";
import { testDatabase } from "./database";
import type { Env } from "../src/env";

class ControlledSocket extends EventTarget {
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  accept() {}
  send(value: string) { this.sent.push(JSON.parse(value) as Record<string, unknown>); }
  close() { this.readyState = 3; }
  emit(value: Record<string, unknown>) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) }));
  }
}

describe("provider lane lifecycle", () => {
  it("waits for an aborted lane's provider terminal and ignores events from a replaced socket", async () => {
    const fixture = await testDatabase();
    const sockets: ControlledSocket[] = [];
    const env: Env = { DB: fixture.db, OPENAI_API_KEY: "synthetic", OPENAI_BASE_URL: "https://provider.test/v1", ADMIN_EMAILS: "", FIREBASE_PROJECT_ID: "test", ALLOWED_ORIGIN: "https://lexiro.test" };
    const fetcher: typeof fetch = async () => {
      const socket = new ControlledSocket();
      sockets.push(socket);
      return { status: 101, webSocket: socket } as unknown as Response;
    };
    const transport = new ProviderWebSocket(env, fetcher);
    try {
      const prepared = await prepareGeneration({ kind: "words", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), raw: "apple" }, "u");
      const abort = new AbortController();
      const first = await transport.send(prepared, undefined, abort.signal, "old-operation");
      abort.abort(new TransportError("test_cancelled", "Cancelled"));
      await expect(first.getReader().read()).rejects.toMatchObject({ code: "test_cancelled" });

      const second = await transport.send(prepared, undefined, new AbortController().signal, "second-operation");
      const socket = sockets[0];
      expect(socket.sent.map((item) => item.stream_id)).toEqual(["old-operation", "second-operation"]);
      socket.emit({ type: "response.output_text.delta", stream_id: "old-operation", delta: "stale text" });
      socket.emit({ type: "response.completed", stream_id: "old-operation", response: { id: "old-response" } });

      const third = await transport.send(prepared, undefined, new AbortController().signal, "third-operation");
      expect(socket.sent[2].stream_id).toBe("old-operation");
      socket.emit({ type: "response.output_text.delta", stream_id: "second-operation", delta: "second text" });
      socket.emit({ type: "response.completed", stream_id: "second-operation", response: { id: "second-response" } });
      socket.emit({ type: "response.output_text.delta", stream_id: "old-operation", delta: "third text" });
      socket.emit({ type: "response.completed", stream_id: "old-operation", response: { id: "third-response" } });
      const secondText = await new Response(second).text();
      expect(secondText).toContain("second text");
      expect(secondText).not.toContain("stale text");
      expect(secondText).not.toContain("old-response");
      expect(await new Response(third).text()).toContain("third text");

      transport.close();
      const fourth = await transport.send(prepared, undefined, new AbortController().signal, "fourth-operation");
      socket.dispatchEvent(new Event("error"));
      socket.dispatchEvent(Object.assign(new Event("close"), { code: 1011, reason: "old socket closed late" }));
      socket.emit({ type: "response.output_text.delta", stream_id: "fourth-operation", delta: "old socket text" });
      sockets[1].emit({ type: "response.output_text.delta", stream_id: "fourth-operation", delta: "fresh text" });
      sockets[1].emit({ type: "response.completed", stream_id: "fourth-operation", response: { id: "fresh-response" } });
      const fourthText = await new Response(fourth).text();
      expect(fourthText).toContain("fresh text");
      expect(fourthText).not.toContain("old socket text");
      expect(sockets).toHaveLength(2);
    } finally {
      transport.close();
      await fixture.runtime.dispose();
    }
  });
});

describe("native Workers WebSocket and Durable Object transport", () => {
  it("reuses one socket across independent batches and persists replayable results", async () => {
    const server = createServer(), sockets = new WebSocketServer({ server });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    let connections = 0, turns = 0, active = 0, peak = 0;
    const responseIds = new Map<string, string>();
    const streamNames = new Set<string>();
    const parallelCompletions: (() => void)[] = [];
    const inputs: Record<string, unknown>[] = [];
    sockets.on("connection", (socket) => {
      connections++;
      socket.on("message", (data) => {
        const request = JSON.parse(data.toString()); inputs.push(request); turns++;
        streamNames.add(request.stream_id);
        if (streamNames.size > 32) {
          socket.send(JSON.stringify({ type: "error", stream_id: request.stream_id, error: { code: "websocket_stream_limit_reached" } }));
          return;
        }
        peak = Math.max(peak, ++active);
        const text = JSON.stringify({ items: [{ senses: [{ pos: "n.", meaningZh: "蘋果", example: "The apple is red." }] }] });
        const response = { id: `resp_native_${turns}`, model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 20 } };
        responseIds.set(JSON.stringify(request.input), response.id);
        socket.send(JSON.stringify({ type: "response.created", stream_id: request.stream_id, response: { id: response.id, model: response.model } }));
        socket.send(JSON.stringify({ type: "response.output_text.delta", stream_id: request.stream_id, delta: text }));
        const complete = () => { active--; socket.send(JSON.stringify({ type: "response.completed", stream_id: request.stream_id, response })); };
        if (turns > 1 && turns <= 5) {
          parallelCompletions.push(complete);
          if (parallelCompletions.length === 4) parallelCompletions.forEach((finish) => finish());
        } else setTimeout(complete, 250);
      });
    });
    let runtime: Miniflare | undefined;
    try {
      const bundled = await build({ stdin: { contents: 'import { GenerationRoom } from "./src/generation-room"; export { GenerationRoom }; export default { fetch(request, env) { return env.GENERATIONS.get(env.GENERATIONS.idFromName("synthetic-session")).fetch(request); } };', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "browser", format: "esm", write: false });
      runtime = new Miniflare({ workers: [{ config: {
        name: "socket-test", compatibilityDate: "2026-09-12",
        manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: bundled.outputFiles[0].text } } },
        exports: { GenerationRoom: { type: "durable-object", storage: "sqlite" } },
        env: { DB: { type: "d1" }, GENERATIONS: { type: "durable-object", worker: "socket-test", exportName: "GenerationRoom" }, OPENAI_API_KEY: { type: "json", value: "synthetic" }, OPENAI_BASE_URL: { type: "json", value: `http://127.0.0.1:${address.port}/v1` } },
      } }] });
      const db = await runtime.getD1Database("DB");
      for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort()) {
        const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
        await db.batch(sql.split(";").map((part) => part.trim()).filter(Boolean).map((part) => db.prepare(part)));
      }
      await db.prepare("INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at) VALUES('u','u@example.test',100,1000,0,'now')").run();
      const session = crypto.randomUUID();
      const firstId = crypto.randomUUID();
      const call = async (id: string, raw: string) => {
        const prepared = await prepareGeneration({ kind: "words", model: "gpt-6-luna", tier: "lite", session, raw }, "u");
        const response = await runtime!.dispatchFetch(`https://test/${id}`, { method: "POST", body: JSON.stringify({ uid: "u", admin: false, prepared }) });
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain("response.completed");
        return { text, responseId: responseIds.get(JSON.stringify(upstreamRequest(prepared).input))! };
      };
      await call(firstId, "apple");
      const sourcesInFlight = ["bank", "current", "rescue", "witness"];
      const replies = await Promise.all(sourcesInFlight.map((source) => call(crypto.randomUUID(), source)));
      replies.forEach((reply, index) => {
        expect(reply.text).toContain(reply.responseId);
        for (const other of replies.filter((_, otherIndex) => otherIndex !== index))
          expect(reply.text).not.toContain(other.responseId);
      });
      expect(peak).toBe(4);
      expect(turns).toBe(5);
      expect(connections).toBe(1);
      expect(inputs.every((input) => input.type === "response.create" && !input.previous_response_id && !("stream" in input))).toBe(true);
      expect(await (await runtime.dispatchFetch(`https://test/${firstId}`)).text()).toContain("response.completed");
      expect(turns).toBe(5);
      expect(await db.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 5 });
      expect(await db.prepare("SELECT points,inflight_id FROM accounts WHERE uid='u'").first()).toEqual({ points: 95, inflight_id: null });
      const sources = ["ant", "bee", "cat", "dog", "elk", "fox", "gnu", "hen", "ibis", "jay", "kite", "lark", "mole", "newt", "owl", "pig", "quail", "rat", "seal", "toad", "vole", "wolf", "yak", "zebra", "pond", "stone", "road", "river", "hill", "lake", "cloud"];
      for (const raw of sources) await call(crypto.randomUUID(), raw);
      expect(turns).toBe(36);
      expect(connections).toBe(1);
      expect(streamNames.size).toBe(4);
      const replay = await (await runtime.dispatchFetch(`https://test/${firstId}`)).text();
      expect(replay).toContain("resp_native_1");
      expect(replay).not.toContain("resp_native_36");
      expect(turns).toBe(36);
      expect(await db.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 36 });
      expect(await db.prepare("SELECT points,inflight_id FROM accounts WHERE uid='u'").first()).toEqual({ points: 64, inflight_id: null });
    } finally {
      await runtime?.dispose();
      for (const socket of sockets.clients) socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});
