import { performance } from "node:perf_hooks";
import { sanitizeResponseStream } from "../dist/response-stream.js";

const encode = new TextEncoder();
const frame = (type, value) => `event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`;
function input(count) {
  const response = { id: "resp_benchmark", model: "synthetic-model", instructions: "private prompt ".repeat(800) };
  const body = encode.encode(frame("response.created", { response }) +
    Array.from({ length: count }, () => frame("response.output_text.delta", { delta: "word " })).join("") +
    frame("response.completed", { response: { ...response, output: [{ content: [{ text: "word ".repeat(count) }] }] } }));
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at === body.length) controller.close();
      else { const end = Math.min(at + 4096, body.length); controller.enqueue(body.subarray(at, end)); at = end; }
    },
  }, { highWaterMark: 0 });
}
const results = [];
for (const count of [256, 2048, 8192]) {
  const samples = [];
  for (let trial = 0; trial < 25; trial++) {
    const upstream = input(count);
    const cpu = process.cpuUsage(), start = performance.now();
    const bytes = (await new Response(sanitizeResponseStream(upstream, { onTerminal: async () => {} })).arrayBuffer()).byteLength;
    const used = process.cpuUsage(cpu);
    if (trial >= 5) samples.push({ ms: performance.now() - start, cpuMs: (used.user + used.system) / 1000, bytes });
  }
  const percentile = (key, fraction) => samples.map((s) => s[key]).sort((a, b) => a - b)[Math.ceil(samples.length * fraction) - 1];
  results.push({ events: count, bytes: samples[0].bytes, wallP50: percentile("ms", .5), wallP95: percentile("ms", .95), processCpuP50: percentile("cpuMs", .5), processCpuP95: percentile("cpuMs", .95) });
}
process.stdout.write(JSON.stringify({
  method: "Synthetic local Node benchmark, 5 warmups + 20 measured runs per size. Includes stream plumbing and output consumption. NOT Cloudflare CPU accounting or a free-tier guarantee.",
  results,
}, null, 2) + "\n");
