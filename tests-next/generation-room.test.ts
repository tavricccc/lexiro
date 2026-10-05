import { describe, it, expect, vi } from "vitest";
import { testDatabase } from "./database";
import { memoryRoomState } from "./room-fixture";
import { GenerationRoom } from "../src/generation-room";
import { prepareGeneration } from "../src/generation";
import { providerFrame, TransportError } from "../src/provider-websocket";
import { account } from "../src/billing";
import type { Env } from "../src/env";

describe("resumable generation actor", () => {
  it("keeps generating after a client disconnect and replays without a second call or charge", async () => {
    const fixture = await testDatabase();
    try {
      const env: Env = { DB: fixture.db, OPENAI_API_KEY: "synthetic", OPENAI_BASE_URL: "https://provider.test/v1", ADMIN_EMAILS: "", FIREBASE_PROJECT_ID: "test", ALLOWED_ORIGIN: "https://lexiro.test" };
      const prepared = await prepareGeneration({ kind: "words", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), raw: "apple" }, "u");
      const pending: Promise<unknown>[] = [], state = memoryRoomState(pending), release = Promise.withResolvers<void>();
      const text = JSON.stringify({ items: [{ senses: [{ pos: "n.", meaningZh: "蘋果", example: "The apple is red." }] }] });
      const result = { id: "resp_resume", model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 20 } };
      const sender = vi.fn(async () => new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(providerFrame({ type: "response.created", response: { id: result.id } }));
        controller.enqueue(providerFrame({ type: "response.output_text.delta", delta: text.slice(0, 20) }));
        void release.promise.then(() => { controller.enqueue(providerFrame({ type: "response.output_text.delta", delta: text.slice(20) })); controller.enqueue(providerFrame({ type: "response.completed", response: result })); controller.close(); });
      } }));
      const room = new GenerationRoom(state, env, sender);
      const id = crypto.randomUUID();
      const start = () => new Request(`https://room/${id}`, { method: "POST", body: JSON.stringify({ uid: "u", admin: false, prepared }) });
      const first = await room.fetch(start());
      const reader = first.body!.getReader();
      await reader.read(); await reader.cancel();
      const balanceDuring = (await account(env.DB, "u"))!.points;
      const duplicate = await room.fetch(start());
      const resumed = duplicate.text();
      release.resolve();
      expect(await resumed).toContain(text.slice(20).replaceAll('"', '\\"'));
      await Promise.all(pending);
      expect(sender).toHaveBeenCalledOnce();
      expect(balanceDuring).toBe(99);
      expect((await account(env.DB, "u"))!.points).toBe(99);
      expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 1 });
      const restored = new GenerationRoom(state, env, sender);
      expect(await (await restored.fetch(new Request(`https://room/${id}`))).text()).toContain("response.completed");
      expect(sender).toHaveBeenCalledOnce();
      expect((await restored.fetch(new Request(`https://room/${crypto.randomUUID()}`))).status).toBe(404);
    } finally { await fixture.runtime.dispose(); }
  });
  it("retrieves the same provider response when its WebSocket closes", async () => {
    const fixture = await testDatabase();
    try {
      const env: Env = { DB: fixture.db, OPENAI_API_KEY: "synthetic", OPENAI_BASE_URL: "https://provider.test/v1", ADMIN_EMAILS: "", FIREBASE_PROJECT_ID: "test", ALLOWED_ORIGIN: "https://lexiro.test" };
      const prepared = await prepareGeneration({ kind: "words", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), raw: "apple" }, "u");
      const text = JSON.stringify({ items: [{ senses: [{ pos: "n.", meaningZh: "蘋果", example: "The apple is red." }] }] });
      let frame = 0;
      const sender = vi.fn(async () => new ReadableStream<Uint8Array>({ pull(controller) {
        if (frame++ === 0) controller.enqueue(providerFrame({ type: "response.created", response: { id: "resp_recovered" } }));
        else if (frame === 2) controller.enqueue(providerFrame({ type: "response.output_text.delta", delta: text.slice(0, 10) }));
        else controller.error(new TransportError("upstream_socket_closed", "Socket closed", { closeCode: 1011 }));
      } }));
      const fetcher = vi.fn<typeof fetch>(async () => Response.json({ id: "resp_recovered", model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 20 } }));
      const pending: Promise<unknown>[] = [];
      const room = new GenerationRoom(memoryRoomState(pending), env, sender, fetcher);
      const response = await room.fetch(new Request(`https://room/${crypto.randomUUID()}`, { method: "POST", body: JSON.stringify({ uid: "u", admin: true, prepared }) }));
      expect(await response.text()).toContain("response.completed");
      await Promise.all(pending);
      expect(sender).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0][0]).toBe("https://provider.test/v1/responses/resp_recovered");
      expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM usage_log").first()).toEqual({ count: 1 });
    } finally { await fixture.runtime.dispose(); }
  });
});
