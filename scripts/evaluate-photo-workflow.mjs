// Real Luna trials using the private Worker prompts and the application's parsers.
// CLI usage includes Codex context; only Responses usage measures this API prefix.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({ options: {
  phase: { type: "string" }, models: { type: "string" },
  tasks: { type: "string", default: "photos,words,vocabulary,cloze,wordBank,discourse,reading,senses,explain" },
  "images-dir": { type: "string" }, reference: { type: "string" },
  "backend-module": { type: "string" }, transport: { type: "string", default: "codex" },
  difficulty: { type: "string", default: "2" }, "batch-index": { type: "string" },
  tier: { type: "string", default: "lite" },
  effort: { type: "string" },
  "repair-from": { type: "string", multiple: true }, feedback: { type: "string" },
  "targeted-repair": { type: "boolean", default: false },
  "dry-run": { type: "boolean", default: false }, help: { type: "boolean", default: false },
} });
const taskOrder = ["photos", "words", "vocabulary", "cloze", "wordBank", "discourse", "reading", "senses", "explain"];
if (values.help) {
  console.log("node scripts/evaluate-photo-workflow.mjs --phase baseline|tuned --models gpt-6-luna,gpt-5.6-luna --tasks photos --images-dir <five-jpg-directory> --reference <lines-json> --transport codex|responses [--difficulty 1|2|3] [--batch-index <zero-based-production-batch>] [--tier lite|thinking] [--effort low|medium|high (evaluation override only)] [--backend-module <frozen-module>] [--repair-from <immutable-run-directory> ...] [--feedback <id-to-error-json>] [--targeted-repair] [--dry-run]");
  process.exit(0);
}
let models = [...new Set((values.models ?? "gpt-6-luna,gpt-5.6-luna").split(","))];
const selected = new Set(values.tasks.split(","));
const difficulty = Number(values.difficulty);
const batchIndex = values["batch-index"] === undefined ? null : Number(values["batch-index"]);
if (!["baseline", "tuned"].includes(values.phase) || !values.reference ||
    models.some((model) => !["gpt-6-luna", "gpt-5.6-luna"].includes(model)) ||
    [...selected].some((task) => !taskOrder.includes(task)) ||
    !["codex", "responses"].includes(values.transport) || !["lite", "thinking"].includes(values.tier) ||
    (values.effort && !["low", "medium", "high"].includes(values.effort)) || ![1, 2, 3].includes(difficulty) ||
    (batchIndex !== null && (!Number.isSafeInteger(batchIndex) || batchIndex < 0))) throw new Error("Invalid phase, models, tasks, reference, transport, difficulty or batch index; use --help.");
if (values.phase === "baseline" && !values["backend-module"]) throw new Error("Baseline requires --backend-module so later prompt edits cannot replace the baseline.");
if (values["targeted-repair"] && !values["repair-from"]?.length) throw new Error("Targeted repair requires an immutable previous run.");
if (selected.has("photos") && !values["images-dir"]) throw new Error("Photos require --images-dir.");
if (values.transport === "responses" && !values["dry-run"] && !process.env.OPENAI_API_KEY) throw new Error("Responses requires OPENAI_API_KEY; no transport fallback is used.");

const root = resolve(import.meta.dirname, "..");
const frontend = resolve(process.env.LEXIRO_FRONTEND_PATH || join(root, "../lexiro"));
const phaseRoot = join(root, "artifacts/ai-quality", values.phase);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const cli = process.env.CODEX_PROMPT_EVAL_CLI || "codex";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const save = (directory, name, data) => writeFile(join(directory, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), { flag: "wx" });
const reasonText = (reason) => {
  const text = reason instanceof Error ? reason.message : String(reason);
  return process.env.OPENAI_API_KEY ? text.replaceAll(process.env.OPENAI_API_KEY, "[redacted]") : text;
};

const servers = [];
async function loadModules() {
  const app = await createServer({ root: frontend, configFile: join(frontend, "vitest.next.config.ts"), server: { watch: { ignored: ["**/*"] } }, logLevel: "error" });
  servers.push(app);
  const tasks = await app.ssrLoadModule("/src/lib/ai/tasks.ts");
  const words = await app.ssrLoadModule("/src/lib/word-generation.ts");
  const library = await app.ssrLoadModule("/src/lib/library.ts");
  const { LIMITS, responseCost } = await app.ssrLoadModule("/packages/ai-contract/src/index.ts");
  let backend;
  if (values["backend-module"]) backend = await import(pathToFileURL(resolve(values["backend-module"])).href);
  else {
    const worker = await createServer({ root, configFile: false, server: { watch: { ignored: ["**/*"] } }, logLevel: "error" });
    servers.push(worker);
    backend = { ...await worker.ssrLoadModule("/src/generation.ts"), ...await worker.ssrLoadModule("/src/organize.ts") };
  }
  return { ...tasks, ...words, ...library, LIMITS, responseCost, backend };
}

async function loadPhotos(limits) {
  if (!selected.has("photos")) return { paths: [], encoded: [], manifest: [] };
  const directory = resolve(values["images-dir"]);
  const names = (await readdir(directory)).filter((name) => /\.jpe?g$/i.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (names.length !== 5) throw new Error(`Expected five source JPG files, found ${names.length}.`);
  const sharp = createRequire(join(frontend, "package.json"))("sharp");
  const paths = [], encoded = [], manifest = [];
  for (const name of names) {
    const path = join(directory, name);
    const bytes = await readFile(path);
    const metadata = await sharp(bytes).metadata();
    let webp;
    for (const quality of [85, 70, 55, 40]) {
      webp = await sharp(bytes).rotate().flatten({ background: "#fff" }).resize({ width: limits.imageEdge, height: limits.imageEdge, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (webp.length <= limits.imageBytes) break;
    }
    if (webp.length > limits.imageBytes) throw new Error(`${name} exceeds the production photo byte limit.`);
    paths.push(path); encoded.push(webp.toString("base64"));
    manifest.push({ name, sourcePath: path, sourceSha256: digest(bytes), width: metadata.width, height: metadata.height, webpSha256: digest(webp), webpBytes: webp.length });
  }
  return { paths, encoded, manifest };
}

function referenceWords(modules, sources) {
  const drafts = sources.map((source, index) => {
    if (!source.posHint || !source.hint) throw new Error(`Reference row ${index + 1} requires a canonical part of speech and one Chinese meaning.`);
    return { word: source.word, senses: [{ id: `reference-${index + 1}`, pos: source.posHint, meaning: source.hint, examples: [], supplementary: false }] };
  });
  return modules.mergeWordDrafts(drafts).map(modules.itemToWordEntry);
}

async function buildCases(modules, model, sources, words, photos) {
  const cases = [];
  const addStep = async (task, step, index, batchCount) => {
    const input = { ...JSON.parse(step.prompt), model, tier: values.tier, session: randomUUID() };
    cases.push({ id: `${task}-${index + 1}`, task, sourceBasis: "manual-reference", productionBatchIndex: index, productionBatchCount: batchCount, prepared: await modules.backend.prepareGeneration(input, "photo-quality-eval"), parse: step.parse, recover: step.recover });
  };
  for (const task of taskOrder.filter((name) => selected.has(name))) {
    if (task === "photos") {
      cases.push({ id: "photos-1", task, sourceBasis: "five-source-photos", prepared: await modules.backend.prepareImages(photos.encoded.join("\n"), randomUUID(), "photo-quality-eval", model, values.tier), parse: modules.parseOrganizedWordInput });
    } else if (task === "words") {
      const steps = modules.wordTask(sources).steps;
      for (const [index, step] of steps.entries()) await addStep(task, step, index, steps.length);
    } else if (task === "senses") {
      const supplements = words.map((word) => ({ word: word.word, existing: word.senses.map((sense) => ({ pos: sense.pos, meaningZh: sense.meaningZh })) }));
      const steps = modules.supplementTask(supplements, 2).steps;
      await addStep(task, steps[0], 0, steps.length);
    } else if (task === "explain") {
      const items = words.slice(0, 5).map((word) => ({ type: "review", word: word.word, pos: word.senses[0].pos, meaning: word.senses[0].meaningZh, example: "" }));
      const prepared = await modules.backend.prepareGeneration({ kind: "explain", raw: JSON.stringify({ items }), model, tier: values.tier, session: randomUUID() }, "photo-quality-eval");
      cases.push({ id: "explain-1", task, sourceBasis: "manual-reference-review-cards", prepared, parse: (text) => { if (!text.trim()) throw new Error("Empty explanation."); return { markdown: text }; } });
    } else {
      // Ten distinct headwords exercise the complete 90-reason word-bank output.
      const start = Math.floor(words.length / 2);
      const sample = task === "wordBank"
        ? [...words.slice(start), ...words.slice(0, start)].slice(0, 10).map((word) => ({ ...word, senses: [word.senses[0]] }))
        : words;
      const steps = modules.questionTask(sample, task, difficulty).steps;
      // Rotate the sampled production batch so later headwords and senses are tested too.
      const index = (batchIndex ?? { vocabulary: 1, cloze: 0, wordBank: 0, discourse: 2, reading: 3 }[task]) % steps.length;
      await addStep(task, steps[index], index, steps.length);
    }
  }
  return cases;
}

async function loadRepairs() {
  const runs = new Map();
  for (const path of values["repair-from"] ?? []) {
    const directory = resolve(path);
    const summary = JSON.parse(await readFile(join(directory, "summary.json"), "utf8"));
    if (!["gpt-6-luna", "gpt-5.6-luna"].includes(summary.requestedModel) || runs.has(summary.requestedModel)) throw new Error("Repair directories must identify distinct supported Luna models.");
    const previous = [];
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith("-metrics.json"))) {
      const metrics = JSON.parse(await readFile(join(directory, filename), "utf8"));
      if (!selected.has(metrics.task)) continue;
      const request = JSON.parse(await readFile(join(directory, `${metrics.id}-request.json`), "utf8"));
      previous.push({ metrics, request });
    }
    runs.set(summary.requestedModel, { directory, previous });
  }
  const feedback = values.feedback ? JSON.parse(await readFile(resolve(values.feedback), "utf8")) : {};
  if (!feedback || Array.isArray(feedback) || typeof feedback !== "object" || Object.values(feedback).some((text) => typeof text !== "string" || !text.trim())) throw new Error("Feedback must be an object mapping a case id to a nonempty error string. Model-specific keys can use model/id.");
  if (!values.models && runs.size) models = [...runs.keys()];
  return { runs, feedback, enabled: runs.size > 0 || Boolean(values.feedback) };
}

async function repairCases(modules, model, cases, repairs) {
  if (!repairs.enabled) return cases;
  const run = repairs.runs.get(model);
  const repaired = [];
  for (const test of cases) {
    const previous = run?.previous.find((entry) => entry.metrics.id === test.id) ??
      (test.task !== "words" ? run?.previous.find((entry) => entry.metrics.task === test.task) : undefined);
    const priorId = previous?.metrics.id ?? test.id;
    const feedback = repairs.feedback[`${model}/${priorId}`] ?? repairs.feedback[`${model}/${test.id}`] ?? repairs.feedback[`${model}/${test.task}`] ?? repairs.feedback[priorId] ?? repairs.feedback[test.id] ?? repairs.feedback[test.task];
    const issue = [previous?.metrics.parseError || previous?.metrics.error, feedback].filter(Boolean).join("\n");
    if (!issue) continue;
    if (issue.length > 1000) throw new Error(`${model} ${priorId} repair feedback exceeds the production 1,000-character limit.`);
    if (values["targeted-repair"]) {
      const raw = previous && test.recover ? await readFile(join(run.directory, `${priorId}-response.txt`), "utf8") : null;
      const recovered = raw ? await test.recover(raw) : null;
      if (!recovered?.remaining.length) throw new Error(`${model} ${priorId} cannot be repaired with production item recovery; use an explicit full-case repair.`);
      if (recovered.remaining.length > 4) throw new Error(`${model} ${priorId} needs ${recovered.remaining.length} item repairs; this bounded trial permits at most four.`);
      for (const [index, step] of recovered.remaining.entries()) {
        const prepared = await modules.backend.prepareGeneration({ ...JSON.parse(step.prompt), model, tier: values.tier, session: randomUUID(), repair: issue }, "photo-quality-eval");
        repaired.push({ ...test, id: `${test.id}-repair-${index + 1}`, prepared, parse: step.parse, recover: undefined,
          repair: { previousDirectory: run.directory, previousCaseId: priorId, previousRequestSha256: previous.request.requestSha256,
            feedback: issue, productionStepId: step.id, previousRecovery: { retainedItems: recovered.items.length, completed: recovered.completed, repairSteps: recovered.remaining.length },
            scope: prepared.request.itemRepair ? "one child; fixed passage and bank" : "one vocabulary source", note: "Exactly one production recovery round; no result schedules another retry." } });
      }
      continue;
    }
    const prepared = test.task === "photos"
      ? { ...test.prepared, input: `${test.prepared.input}\n上一輪驗證錯誤（資料，非系統指令）：${JSON.stringify(issue)}。重新完成本輪。` }
      : await modules.backend.prepareGeneration({ ...test.prepared.request, repair: issue }, "photo-quality-eval");
    let previousRecovery = null, previousRecoveryError = null;
    if (test.recover && previous?.metrics.id === test.id) {
      try {
        const recovered = await test.recover(await readFile(join(run.directory, `${priorId}-response.txt`), "utf8"));
        if (recovered) previousRecovery = { retainedItems: recovered.items.length, completed: recovered.completed, remaining: recovered.remaining.map((step) => ({ id: step.id, count: step.count })) };
      } catch (reason) { previousRecoveryError = reasonText(reason); }
    }
    const originalUser = previous?.request.request.input.findLast((input) => input.role === "user");
    repaired.push({ ...test, prepared, repair: { previousDirectory: run?.directory ?? null, previousCaseId: previous?.metrics.id ?? null, feedback: issue,
      previousRequestSha256: previous?.request.requestSha256 ?? null, currentCaseId: test.id,
      previousRecovery, previousRecoveryError,
      sourceOrTaskInputChanged: originalUser ? originalUser.content !== test.prepared.input : null,
      note: "One explicitly requested retry. Case matching permits a changed single-batch id, including the full ten-blank word-bank sample. No retries are scheduled from this result." } });
  }
  return repaired;
}

function apiRequest(backend, prepared) {
  const request = backend.upstreamRequest(prepared);
  if (values.effort) request.reasoning.effort = values.effort;
  if (prepared.images) request.input[request.input.length - 1] = { role: "user", content: [
    { type: "input_text", text: prepared.input },
    ...prepared.images.map((base64) => ({ type: "input_image", image_url: `data:image/webp;base64,${base64}`, detail: "high" })),
  ] };
  return request;
}

function codexPrompt(test) {
  return `Generate the requested Lexiro result. Do not inspect files, browse, run commands, or use tools. The instructions and source data below are the complete task. ${test.prepared.schema ? "Return only the requested JSON." : "Return the requested teaching text."}\n\n${test.prepared.instructions}\n\n${test.prepared.input}`;
}

async function runCodex(test, schemaPath, scratch, photos) {
  const answerPath = join(scratch, "answer.txt");
  const isScript = cli.endsWith(".js");
  const args = [ ...(isScript ? [cli] : []), "exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--cd", scratch,
    "--model", test.prepared.request.model, "-c", `model_reasoning_effort="${test.effort}"`, "--json", "--color", "never",
    ...(test.task === "photos" ? photos.paths.flatMap((path) => ["--image", path]) : []),
    ...(test.prepared.schema ? ["--output-schema", schemaPath] : []), "--output-last-message", answerPath, "-" ];
  const started = Date.now();
  const capture = await new Promise((resolveCall, reject) => {
    const child = spawn(isScript ? process.execPath : cli, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", stderr = "", firstTextMs = null, usage = null, reportedModel = null, timedOut = false;
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
    child.stdout.on("data", (chunk) => { buffer += chunk.toString(); let at; while ((at = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, at)); buffer = buffer.slice(at + 1); } });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-16_000); });
    child.on("error", reject);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 300_000);
    child.on("close", (code) => { clearTimeout(timer); consume(buffer); resolveCall({ code, timedOut, stderr: reasonText(stderr), firstTextMs, usage, reportedModel, transcript }); });
    child.stdin.end(codexPrompt(test));
  });
  const raw = await readFile(answerPath, "utf8").catch((reason) => { if (reason.code === "ENOENT") return ""; throw reason; });
  return { raw, durationMs: Date.now() - started, firstTextMs: capture.firstTextMs, firstTextMetric: "first-cli-text-event; may be the completed message", reportedModel: capture.reportedModel,
    cliUsage: capture.usage, usageScope: "Codex conversation including CLI context; not the Lexiro API prefix or project API cost", transcript: capture.transcript, stderr: capture.stderr,
    error: capture.code === 0 && !capture.timedOut ? null : `CLI ${capture.timedOut ? "timed out" : `exited ${capture.code}`}` };
}

async function runResponses(request) {
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

async function evaluateModel(modules, model, sources, words, photos, reference, repairs) {
  const directory = join(phaseRoot, model, runId);
  await mkdir(directory, { recursive: true });
  await save(directory, "reference.json", { reference, words, sourceBasis: "Manual reference isolates writer quality from photo and word-generation errors; no previous responses are replayed." });
  const cases = await repairCases(modules, model, await buildCases(modules, model, sources, words, photos), repairs);
  const results = [];
  for (const test of cases) {
    const request = apiRequest(modules.backend, test.prepared);
    const savedRequest = structuredClone(request);
    if (test.task === "photos") savedRequest.input.at(-1).content = [{ type: "input_text", text: test.prepared.input }, ...photos.manifest.map((image) => ({ type: "input_image", sourcePath: image.sourcePath, webpSha256: image.webpSha256, detail: "high" }))];
    const sampleSources = test.prepared.request.sources;
    await save(directory, `${test.id}-request.json`, { requestedModel: model, tier: test.prepared.request.tier, effort: request.reasoning.effort, effortOverride: values.effort ?? null, transport: values.transport, sourceBasis: test.sourceBasis, difficulty, cacheKey: test.prepared.cacheKey, request: savedRequest, requestSha256: digest(JSON.stringify(request)), imageManifest: test.task === "photos" ? photos.manifest : [],
      ...(test.repair ? { repair: test.repair } : {}),
      ...(test.productionBatchCount ? { productionBatchIndex: test.productionBatchIndex, productionBatchCount: test.productionBatchCount } : {}),
      ...(sampleSources ? { sampledSources: sampleSources.length, sampledHeadwords: [...new Set(sampleSources.map((source) => source.word))], referenceSources: sources.length, note: "A selected production batch; not coverage of every reference sense." } : {}),
      photoEncoding: test.task === "photos" ? values.transport === "codex" ? "CLI receives all five original JPGs; WebP preparation only validates the production envelope" : "Node sharp WebP uses production edge/quality/byte limits; browser canvas encoding is not being tested" : null });
    if (values.transport === "codex") await save(directory, `${test.id}-cli-prompt.txt`, codexPrompt(test));
    if (values["dry-run"]) { results.push({ id: test.id, task: test.task, dryRun: true, ...(test.repair ? { repair: test.repair } : {}) }); continue; }
    const scratch = await mkdtemp(join(tmpdir(), "lexiro-photo-eval-"));
    const schemaPath = join(scratch, "schema.json");
    if (test.prepared.schema) await writeFile(schemaPath, JSON.stringify(test.prepared.schema));
    let capture;
    const started = Date.now();
    try { capture = values.transport === "codex" ? await runCodex({ ...test, effort: request.reasoning.effort }, schemaPath, scratch, photos) : await runResponses(request); }
    catch (reason) { capture = { raw: "", durationMs: Date.now() - started, error: reasonText(reason) }; }
    await save(directory, `${test.id}-response.txt`, capture.raw);
    if (capture.providerResponse) await save(directory, `${test.id}-provider-response.json`, capture.providerResponse);
    await save(directory, `${test.id}-transcript.json`, { events: capture.transcript ?? [], stderr: capture.stderr ?? "" });
    let parsed = null, parseError = null, photoCoverage, recovery = null, recoveryError = null;
    if (!capture.error) {
      try {
        parsed = test.parse(capture.raw);
        if (test.task === "photos") {
          const expected = new Set(sources.map((source) => modules.normalizeWordKey(source.word)));
          const actual = new Set(modules.buildWordGenerationSources(parsed.join("\n")).map((source) => modules.normalizeWordKey(source.word)));
          photoCoverage = { expectedHeadwords: expected.size, actualHeadwords: actual.size, missing: [...expected].filter((word) => !actual.has(word)), extra: [...actual].filter((word) => !expected.has(word)), note: "Headword coverage does not verify every meaning, part of speech or handwritten correction." };
        }
      } catch (reason) {
        parseError = reasonText(reason);
        if (test.recover) {
          try {
            const recovered = await test.recover(capture.raw);
            if (recovered) recovery = { items: recovered.items, completed: recovered.completed, remaining: recovered.remaining.map((step) => ({ id: step.id, count: step.count })) };
          } catch (recoveryReason) { recoveryError = reasonText(recoveryReason); }
        }
      }
    }
    await save(directory, `${test.id}-parsed.json`, parsed);
    if (test.recover) await save(directory, `${test.id}-recovery.json`, { recovery, recoveryError, note: "Application recovery only; remaining requests are recorded and never executed by this evaluator." });
    const { raw: _raw, providerResponse: _provider, transcript: _transcript, stderr: _stderr, ...metrics } = capture;
    const result = { id: test.id, task: test.task, requestedModel: model, ...metrics, parseError, parsedCount: Array.isArray(parsed) ? parsed.length : null,
      ...(test.repair ? { repair: test.repair } : {}),
      ...(test.recover ? { recovery: recovery ? { retainedItems: recovery.items.length, completed: recovery.completed, remaining: recovery.remaining } : null, recoveryError } : {}),
      ...(capture.apiTokens ? { estimatedCostUsd: Object.values(capture.apiTokens).every(Number.isFinite) ? modules.responseCost({ model: capture.reportedModel, ...capture.apiTokens }) : null, costBasis: "Complete provider usage at the shared Standard rates; not an invoice or project balance." } : {}),
      ...(photoCoverage ? { photoCoverage } : {}) };
    await save(directory, `${test.id}-metrics.json`, result); results.push(result);
    console.log(`${values.phase} ${model} ${test.id}: ${capture.error || parseError ? "FAIL " + (capture.error || parseError) : "PARSED"} (${capture.durationMs ?? "unknown"} ms)`);
    if (capture.error) break;
  }
  await save(directory, "summary.json", { phase: values.phase, transport: values.transport, requestedModel: model, requestedTier: values.tier, effortOverride: values.effort ?? null, difficulty, batchIndex, backendModule: values["backend-module"] ? resolve(values["backend-module"]) : "current src", immutableRun: runId, plannedCases: cases.length, completedCases: results.length, results });
  console.log(`Artifacts: ${directory}`);
  return results;
}

try {
  const modules = await loadModules();
  const repairs = await loadRepairs();
  const reference = JSON.parse(await readFile(resolve(values.reference), "utf8"));
  const lines = modules.parseOrganizedWordInput(JSON.stringify(reference));
  const sources = modules.buildWordGenerationSources(lines.join("\n"));
  if (!sources.length) throw new Error("Reference contains no valid word sources.");
  const words = referenceWords(modules, sources);
  const photos = await loadPhotos(modules.LIMITS);
  const runs = await Promise.allSettled(models.map((model) => evaluateModel(modules, model, sources, words, photos, reference, repairs)));
  for (const run of runs) {
    if (run.status === "rejected") { console.error(reasonText(run.reason)); process.exitCode = 1; }
    else if (run.value.some((result) => result.error || result.parseError)) process.exitCode = 1;
  }
} finally { await Promise.all(servers.map((server) => server.close())); }
