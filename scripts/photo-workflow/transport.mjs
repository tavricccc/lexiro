import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { reasonText } from "./artifacts.mjs";

export function apiRequest(config, backend, prepared) {
  const { values } = config;
  const request = backend.upstreamRequest(prepared);
  if (values.effort) request.reasoning.effort = values.effort;
  if (prepared.images) request.input[request.input.length - 1] = { role: "user", content: [
    { type: "input_text", text: prepared.input },
    ...prepared.images.map((base64) => ({ type: "input_image", image_url: `data:image/webp;base64,${base64}`, detail: "high" })),
  ] };
  return request;
}

export function codexPrompt(test) {
  return `Generate the requested Lexiro result. Do not inspect files, browse, run commands, or use tools. The instructions and source data below are the complete task. ${test.prepared.schema ? "Return only the requested JSON." : "Return the requested teaching text."}\n\n${test.prepared.instructions}\n\n${test.prepared.input}`;
}

export async function runCodex(config, test, schemaPath, scratch, photos) {
  const { cli } = config;
  const answerPath = join(scratch, "answer.txt");
  const isScript = /\.(?:c|m)?js$/i.test(cli);
  const args = [ ...(isScript ? [cli] : []), "exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--cd", scratch,
    "--model", test.prepared.request.model, "-c", `model_reasoning_effort="${test.effort}"`, "--json", "--color", "never",
    ...(test.task === "photos" ? photos.paths.flatMap((path) => ["--image", path]) : []),
    ...(test.prepared.schema ? ["--output-schema", schemaPath] : []), "--output-last-message", answerPath, "-" ];
  const started = Date.now();
  const capture = await new Promise((resolveCall, reject) => {
    const child = spawn(isScript ? process.execPath : cli, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", jsonl = "", stderr = "", firstTextMs = null, usage = null, reportedModel = null, timedOut = false;
    const transcript = [];
    const consume = (line) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      const text = event.item?.type === "agent_message" ? event.item.text : event.delta;
      if (typeof text === "string" && text.length && firstTextMs === null) firstTextMs = Date.now() - started;
      if (event.type === "turn.completed") usage = event.usage;
      reportedModel ??= event.model ?? event.response?.model ?? null;
      transcript.push({ type: event.type, atMs: Date.now() - started, ...(event.item ? { itemType: event.item.type, itemStatus: event.item.status } : {}), ...(event.usage ? { usage: event.usage } : {}), ...(event.error ? { error: reasonText(event.error.message ?? event.error) } : {}) });
    };
    child.stdout.on("data", (chunk) => { jsonl += chunk.toString(); buffer += chunk.toString(); let at; while ((at = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, at)); buffer = buffer.slice(at + 1); } });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 300_000);
    child.on("close", (code) => { clearTimeout(timer); consume(buffer); resolveCall({ code, timedOut, stderr: reasonText(stderr), firstTextMs, usage, reportedModel, transcript, jsonl: reasonText(jsonl) }); });
    child.stdin.end(codexPrompt(test));
  });
  const raw = await readFile(answerPath, "utf8").catch((reason) => { if (reason.code === "ENOENT") return ""; throw reason; });
  return { raw, durationMs: Date.now() - started, firstTextMs: capture.firstTextMs, firstTextMetric: "first-cli-text-event; may be the completed message", reportedModel: capture.reportedModel,
    cliUsage: capture.usage, cliJsonl: capture.jsonl, cliStartupMs: capture.transcript.find(event => event.type === "turn.started")?.atMs ?? null, usageScope: "Codex conversation including CLI context; not the Lexiro API prefix or project API cost", transcript: capture.transcript, stderr: capture.stderr,
    error: capture.code === 0 && !capture.timedOut ? null : `CLI ${capture.timedOut ? "timed out" : `exited ${capture.code}`}` };
}

export async function runResponses(request) {
  const started = Date.now();
  const response = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/responses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(request), signal: AbortSignal.timeout(300_000) });
  if (!response.ok) return { raw: await response.text(), durationMs: Date.now() - started, error: `Responses HTTP ${response.status}` };
  const decoder = new TextDecoder();
  let buffer = "", raw = "", providerResponse = null, firstTextMs = null, error = null;
  const transcript = [];
  const consume = (block) => {
    const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data);
    if (event.type === "response.output_text.delta") { raw += event.delta; firstTextMs ??= Date.now() - started; }
    if (["response.completed", "response.incomplete", "response.failed"].includes(event.type)) providerResponse = event.response;
    if (["response.failed", "error"].includes(event.type)) error = `Responses ${event.type}`;
    transcript.push({ type: event.type, atMs: Date.now() - started, ...(event.response?.usage ? { usage: event.response.usage } : {}) });
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true }).replaceAll("\r", "");
    let at; while ((at = buffer.indexOf("\n\n")) >= 0) { consume(buffer.slice(0, at)); buffer = buffer.slice(at + 2); }
  }
  buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
  if (!providerResponse) error = "Responses stream ended without a terminal response.";
  else if (providerResponse.status !== "completed") error = `Responses ${providerResponse.status}`;
  const usage = providerResponse?.usage;
  return { raw, providerResponse, reportedModel: providerResponse?.model ?? null, apiUsage: usage ?? null,
    apiTokens: usage ? { input: usage.input_tokens, cached: usage.input_tokens_details?.cached_tokens ?? null, cacheWrite: usage.input_tokens_details?.cache_write_tokens ?? null, output: usage.output_tokens } : null,
    durationMs: Date.now() - started, firstTextMs, firstTextMetric: "first-response-output-text-delta", usageScope: "Responses API request with production schema and explicit breakpoints", transcript, error };
}
