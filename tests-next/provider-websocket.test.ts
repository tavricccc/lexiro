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
    let connections = 0, turns = 0;
    const inputs: Record<string, unknown>[] = [];
    sockets.on("connection", (socket) => {
      connections++;
      socket.on("message", (data) => {
        const request = JSON.parse(data.toString()); inputs.push(request); turns++;
        const text = JSON.stringify({ items: [{ senses: [{ pos: "n.", meaningZh: "蘋果", example: "The apple is red." }] }] });
        const response = { id: `resp_native_${turns}`, model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 20 } };
        socket.send(JSON.stringify({ type: "response.created", response: { id: response.id, model: response.model } }));
        socket.send(JSON.stringify({ type: "response.output_text.delta", delta: text }));
        socket.send(JSON.stringify({ type: "response.completed", response }));
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
      const prepared = await prepareGeneration({ kind: "words", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), raw: "apple" }, "u");
      const firstId = crypto.randomUUID();
      for (const id of [firstId, crypto.randomUUID()]) {
        const response = await runtime.dispatchFetch(`https://test/${id}`, { method: "POST", body: JSON.stringify({ uid: "u", admin: false, prepared }) });
        expect(response.status).toBe(200);
        expect(await response.text()).toContain("response.completed");
      }
      expect(turns).toBe(2);
      expect(connections).toBe(1);
      expect(inputs.every((input) => input.type === "response.create" && !input.previous_response_id && !("stream" in input))).toBe(true);
      expect(await (await runtime.dispatchFetch(`https://test/${firstId}`)).text()).toContain("response.completed");
      expect(turns).toBe(2);
      expect(await db.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 2 });
    } finally {
      await runtime?.dispose();
      for (const socket of sockets.clients) socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 20_000);
});
