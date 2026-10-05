import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { WebSocketServer } from "ws";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { prepareGeneration } from "../src/generation";

describe("native Workers WebSocket and Durable Object transport", () => {
  it("reuses one socket across independent batches and persists replayable results", async () => {
    const server = createServer(), sockets = new WebSocketServer({ server });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    let connections = 0, turns = 0, active = 0, peak = 0;
    const responseIds = new Map<string, string>();
    const inputs: Record<string, unknown>[] = [];
    sockets.on("connection", (socket) => {
      connections++;
      socket.on("message", (data) => {
        const request = JSON.parse(data.toString()); inputs.push(request); turns++; peak = Math.max(peak, ++active);
        const text = JSON.stringify({ items: [{ senses: [{ pos: "n.", meaningZh: "蘋果", example: "The apple is red." }] }] });
        const response = { id: `resp_native_${turns}`, model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 20 } };
        responseIds.set(request.stream_id, response.id);
        socket.send(JSON.stringify({ type: "response.created", stream_id: request.stream_id, response: { id: response.id, model: response.model } }));
        socket.send(JSON.stringify({ type: "response.output_text.delta", stream_id: request.stream_id, delta: text }));
        setTimeout(() => { active--; socket.send(JSON.stringify({ type: "response.completed", stream_id: request.stream_id, response })); }, 250);
      });
    });
    let runtime: Miniflare | undefined;
    try {
      const bundled = await build({ stdin: { contents: 'import { GenerationRoom } from "./src/generation-room"; export { GenerationRoom }; export default { fetch(request, env) { return env.GENERATIONS.get(env.GENERATIONS.idFromName("synthetic-session")).fetch(request); } };', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "browser", format: "esm", write: false });
      runtime = new Miniflare({ workers: [{ config: {
        type: "worker", name: "socket-test", compatibilityDate: "2026-09-12",
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
        return text;
      };
      await call(firstId, "apple");
      const ids = [crypto.randomUUID(), crypto.randomUUID()];
      const replies = await Promise.all(ids.map((id, index) => call(id, index ? "current" : "bank")));
      replies.forEach((reply, index) => { expect(reply).toContain(responseIds.get(ids[index])); expect(reply).not.toContain(responseIds.get(ids[1 - index])); });
      expect(peak).toBe(2);
      expect(turns).toBe(3);
      expect(connections).toBe(1);
      expect(inputs.every((input) => input.type === "response.create" && !input.previous_response_id && !("stream" in input))).toBe(true);
      expect(await (await runtime.dispatchFetch(`https://test/${firstId}`)).text()).toContain("response.completed");
      expect(turns).toBe(3);
      expect(await db.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 3 });
      expect(await db.prepare("SELECT points,inflight_id FROM accounts WHERE uid='u'").first()).toEqual({ points: 97, inflight_id: null });
    } finally {
      await runtime?.dispose();
      for (const socket of sockets.clients) socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 20_000);
});
