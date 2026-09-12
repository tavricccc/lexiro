// Deterministic local-only provider for visual QA. Never uses or logs credentials.
// Run: node tests-next/fixtures/ai-preview-server.mjs
import { createServer } from "node:http";
let sequence = 0;
createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (request.method !== "POST") { response.writeHead(405); response.end(); return; }
  let body = "";
  for await (const chunk of request) body += chunk;
  const data = JSON.parse(body), input = data.input ?? data.messages;
  const prompt = typeof input === "string" ? input : input.at(-1).content;
  const refs = [...String(prompt).matchAll(/source-\d+/g)].map((m) => m[0]);
  const text = refs.length ? JSON.stringify({ words: [...new Set(refs)].map((sourceRef) => ({ sourceRef, senses: [{ pos: "n.", meaningZh: "測試字義", examples: [] }] })) }) : "OK";
  const id = `fixture-${++sequence}`;
  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const event = (payload) => response.write(`data: ${JSON.stringify(payload)}\n\n`);
  event({ type: "response.created", response: { id, status: "in_progress" } });
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (response.destroyed) return;
  event({ type: "response.output_text.delta", delta: text.slice(0, Math.floor(text.length / 2)) });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  if (response.destroyed) return;
  event({ type: "response.output_text.delta", delta: text.slice(Math.floor(text.length / 2)) });
  event({ type: "response.completed", response: { id, status: "completed", output: [], usage: { input_tokens: 2100, output_tokens: 150, input_tokens_details: { cached_tokens: sequence > 1 ? 1800 : 0 } } } });
  response.end();
}).listen(4011, "127.0.0.1", () => process.stdout.write("Local AI preview fixture on http://localhost:4011\n"));
