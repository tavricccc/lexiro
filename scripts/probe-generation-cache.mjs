import WebSocket from "ws";
import { cacheProbeInput, responseCost } from "../dist/cache-probe-input.js";

const endpoint = new URL(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/responses`);
endpoint.protocol = "wss:";
if (!process.env.OPENAI_API_KEY) throw new Error("Production key is required for the cache probe");
const socket = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, handshakeTimeout: 15_000 });
const pending = new Map();
socket.on("message", (data) => {
  const event = JSON.parse(data.toString());
  if (event.type === "error" && !event.stream_id) {
    for (const task of pending.values()) task.reject(new Error(`Provider rejected multiplexing (${event.error?.code ?? "unknown"})`));
    return;
  }
  const task = pending.get(event.stream_id);
  if (!task) return;
  if (event.type === "response.created") task.firstEventMs ??= Date.now() - task.startedAt;
  if (event.type === "error" || event.type === "response.failed") {
    clearTimeout(task.timer); pending.delete(event.stream_id);
    task.reject(new Error(`Provider rejected the cache probe (${event.error?.code ?? event.response?.error?.code ?? "unknown"})`));
  }
  if (["response.completed", "response.incomplete"].includes(event.type)) {
    clearTimeout(task.timer); pending.delete(event.stream_id);
    const usage = event.response.usage;
    task.resolve({ model: event.response.model, input: usage?.input_tokens, cached: usage?.input_tokens_details?.cached_tokens ?? 0, cacheWrite: usage?.input_tokens_details?.cache_write_tokens ?? 0, output: usage?.output_tokens, firstEventMs: task.firstEventMs, elapsedMs: Date.now() - task.startedAt });
  }
});
socket.on("close", () => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error("Cache probe socket closed")); } });
socket.on("error", () => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error("Cache probe socket failed")); } });
const opened = Date.now();
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", () => reject(new Error("Cache probe handshake failed"))); });
console.log(JSON.stringify({ connectionMs: Date.now() - opened, maxOutputPerRequest: 128 }));
const send = async (model, tier, word) => {
  const streamId = crypto.randomUUID();
  const input = await cacheProbeInput(model, tier, word, streamId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(streamId); reject(new Error("Cache probe timed out")); }, 60_000);
    pending.set(streamId, { resolve, reject, timer, startedAt: Date.now() });
    socket.send(JSON.stringify(input));
  });
};
const costs = [];
try {
  for (const [model, tier] of [["gpt-6-luna", "lite"], ["gpt-5.6-luna", "lite"], ["gpt-6-luna", "pro"]]) {
    const warm = await send(model, tier, "recover");
    const parallel = await Promise.all([send(model, tier, "detect"), send(model, tier, "adapt")]);
    console.log(JSON.stringify({ warm, parallel, cacheHit: parallel.every((usage) => usage.cached >= 1024) }));
    costs.push(...[warm, ...parallel].map(responseCost));
    if (!parallel.every((usage) => usage.cached >= 1024)) throw new Error(`Parallel prefix cache was not confirmed for ${warm.model}; deployment stopped`);
  }
  console.log(JSON.stringify({ requests: 9, estimatedCostUsd: costs.some((cost) => cost === null) ? null : costs.reduce((sum, cost) => sum + cost, 0) }));
} finally { socket.close(1000); }
