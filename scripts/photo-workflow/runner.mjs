import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiRequest, codexPrompt, runCodex, runResponses } from './transport.mjs';
import { digest, save, reasonText } from './artifacts.mjs';
import { buildCases } from './cases.mjs';
import { repairCases } from './repairs.mjs';
import { schedule } from './scheduler.mjs';
import { parseCapture, summarize } from './metrics.mjs';

async function saveRequest(config, directory, model, test, request, photos, sources) {
  const savedRequest = structuredClone(request);
  if (test.task === 'photos') savedRequest.input.at(-1).content = [{ type: 'input_text', text: test.prepared.input }, ...photos.manifest.map(image => ({ type: 'input_image', sourcePath: image.sourcePath, webpSha256: image.webpSha256, detail: 'high' }))];
  const sampleSources = test.prepared.request.sources;
  await save(directory, `${test.id}-request.json`, {
    requestedModel: model, tier: test.prepared.request.tier, effort: request.reasoning.effort, effortOverride: config.values.effort ?? null,
    transport: config.values.transport, sourceBasis: test.sourceBasis, difficulty: config.difficulty,
    cacheKey: test.prepared.cacheKey, request: savedRequest, requestSha256: digest(JSON.stringify(request)),
    generationInput: test.prepared.request, parserContext: test.parserContext, sourceIndices: test.sourceIndices,
    batchMode: test.batchMode, batchSize: config.batchSize, productionBatchIndex: test.productionBatchIndex, productionBatchCount: test.productionBatchCount,
    schemaSha256: test.prepared.schema ? digest(JSON.stringify(test.prepared.schema)) : null,
    fixedPromptSha256: digest(JSON.stringify({ instructions: test.prepared.instructions, schema: test.prepared.schema, cacheKey: test.prepared.cacheKey })),
    imageManifest: test.task === 'photos' ? photos.manifest : [], ...(test.repair ? { repair: test.repair } : {}),
    ...(sampleSources ? { sampledSources: sampleSources.length, sampledHeadwords: [...new Set(sampleSources.map(source => source.word))], referenceSources: sources.length } : {}),
    photoEncoding: test.task === 'photos' ? config.values.transport === 'codex' ? 'CLI receives all five original JPGs; WebP preparation validates the production envelope' : 'sharp WebP uses production limits; browser canvas encoding is not tested' : null,
  });
  if (config.values.transport === 'codex') await save(directory, `${test.id}-cli-prompt.txt`, codexPrompt(test));
}

async function executeJob(config, modules, job, sources, units, photos, executionStarted) {
  const { test, directory, request, model } = job;
  const startedAtMs = Date.now() - executionStarted;
  const scratch = await mkdtemp(join(tmpdir(), 'lexiro-photo-eval-'));
  const schemaPath = join(scratch, 'schema.json');
  if (test.prepared.schema) await writeFile(schemaPath, JSON.stringify(test.prepared.schema));
  let capture;
  const started = Date.now();
  try {
    capture = config.values.transport === 'codex'
      ? await runCodex(config, { ...test, effort: request.reasoning.effort }, schemaPath, scratch, photos)
      : await runResponses(request);
  } catch (reason) { capture = { raw: '', durationMs: Date.now() - started, error: reasonText(reason) }; }
  await save(directory, `${test.id}-response.txt`, capture.raw);
  if (capture.providerResponse) await save(directory, `${test.id}-provider-response.json`, capture.providerResponse);
  if (capture.cliJsonl !== undefined) await save(directory, `${test.id}-cli-events.jsonl`, capture.cliJsonl);
  await save(directory, `${test.id}-transcript.json`, { events: capture.transcript ?? [], stderr: capture.stderr ?? '' });
  const analysis = parseCapture(modules, test, capture, sources, units);
  await save(directory, `${test.id}-parsed.json`, analysis.parsed);
  if (test.recover) await save(directory, `${test.id}-recovery.json`, { recovery: analysis.recovery, recoveryError: analysis.metrics.recoveryError, note: 'Native recovery inspected once; no remaining requests are executed.' });
  const { raw: _raw, providerResponse: _provider, transcript: _transcript, stderr: _stderr, cliJsonl: _jsonl, ...metrics } = capture;
  const apiBudget = request.max_output_tokens ?? null;
  const result = {
    id: test.id, task: test.task, requestedModel: model, ...metrics, ...analysis.metrics,
    replyCharacters: capture.raw.length, startedAtMs, queueDelayMs: startedAtMs, completedAtMs: Date.now() - executionStarted,
    apiRequestedMaxOutputTokens: apiBudget,
    cliOutputAboveApiBudget: Number.isFinite(capture.cliUsage?.output_tokens) && Number.isFinite(apiBudget) ? capture.cliUsage.output_tokens > apiBudget : null,
    apiOutputWithinRequestedBudget: Number.isFinite(capture.apiTokens?.output) && Number.isFinite(apiBudget) ? capture.apiTokens.output <= apiBudget : null,
    budgetBasis: 'CLI output is diagnostic only and does not prove the saved API output budget was enforced.',
    ...(test.repair ? { repair: test.repair } : {}),
    ...(capture.apiTokens ? { estimatedCostUsd: Object.values(capture.apiTokens).every(Number.isFinite) ? modules.responseCost({ model: capture.reportedModel, ...capture.apiTokens }) : null, costBasis: 'Complete Responses provider usage only; not an invoice or project balance.' } : {}),
  };
  await save(directory, `${test.id}-metrics.json`, result);
  console.log(`${config.values.phase} ${model} ${test.id}: ${result.status}${capture.error || result.parseError ? ' ' + (capture.error || result.parseError) : ''} (${capture.durationMs ?? 'unknown'} ms; retained ${result.retainedUnits})`);
  return result;
}

export async function evaluateRound(config, modules, { reference, sources, words, units, photos, repairs }) {
  const roundDirectory = join(config.phaseRoot, 'runs', config.runId);
  await mkdir(roundDirectory, { recursive: true });
  const jobs = [], modelCases = new Map(), directories = new Map();
  for (const model of config.models) {
    const directory = join(config.phaseRoot, model, config.runId);
    directories.set(model, directory);
    await mkdir(directory, { recursive: true });
    await save(directory, 'reference.json', { reference, words, sources, sourceUnits: units, sourceBasis: 'Manual reference; source order retained. Earlier model replies are not conversation context.' });
    const cases = await repairCases(config, modules, model, await buildCases(config, modules, model, sources, words, units, photos), repairs);
    modelCases.set(model, cases);
    for (const test of cases) {
      const request = apiRequest(config, modules.backend, test.prepared);
      await saveRequest(config, directory, model, test, request, photos, sources);
      jobs.push({ model, test, directory, request, groupKey: `${model}/${test.task}/${test.prepared.cacheKey}` });
    }
  }
  const preparationMs = Date.now() - config.startedAt;
  const settings = { phase: config.values.phase, transport: config.values.transport, requestedTier: config.values.tier,
    cliExecutable: config.values.transport === 'codex' ? config.cli : null,
    difficulty: config.difficulty, batchSize: config.batchSize, batchIndex: config.batchIndex, concurrency: config.concurrency,
    warmFirst: config.values['warm-first'], effortOverride: config.values.effort ?? null, immutableRun: config.runId,
    sourceReferenceSha256: digest(JSON.stringify(reference)), frontendParser: modules.frontendVersion, parserContract: modules.questionContract, backend: modules.backendVersion };
  await save(roundDirectory, 'plan.json', { ...settings, modelDirectories: Object.fromEntries(directories), plannedCases: jobs.map(job => ({ model: job.model, id: job.test.id, task: job.test.task, groupKey: job.groupKey,
    sourceIndices: job.test.sourceIndices, sourceWords: job.test.prepared.request.sources?.map(source => source.word) ?? [], batchMode: job.test.batchMode,
    apiRequestedMaxOutputTokens: job.request.max_output_tokens, cacheKey: job.test.prepared.cacheKey })),
    method: 'Fixed independent requests are saved before dispatch. Warm-first gates the first request per model/task/cache key; passage groups remain indivisible. CLI concurrency measures overlapping CLI processes, not provider lanes.' });
  const executionStarted = Date.now();
  const scheduling = config.values['dry-run'] ? { maximumActive: 0, stoppedModels: [], outcomes: jobs.map(job => ({ job, result: { id: job.test.id, task: job.test.task, requestedModel: job.model, status: 'PLANNED', dryRun: true, plannedSourceIndices: job.test.sourceIndices } })) }
    : await schedule(jobs, { concurrency: config.concurrency, warmFirst: config.values['warm-first'], execute: job => executeJob(config, modules, job, sources, units, photos, executionStarted) });
  const results = [];
  for (const outcome of scheduling.outcomes) {
    const result = outcome.skipped ? { id: outcome.job.test.id, task: outcome.job.test.task, requestedModel: outcome.job.model, status: 'SKIPPED', skipReason: outcome.reason, plannedSourceIndices: outcome.job.test.sourceIndices } : outcome.result;
    if (outcome.skipped) await save(outcome.job.directory, `${outcome.job.test.id}-metrics.json`, result);
    results.push(result);
  }
  const timing = { preparationMs, executionWallClockMs: Date.now() - executionStarted, roundWallClockMs: Date.now() - config.startedAt, maximumActiveRequests: scheduling.maximumActive, stoppedModels: scheduling.stoppedModels };
  for (const model of config.models) {
    const scoped = results.filter(result => result.requestedModel === model);
    await save(directories.get(model), 'summary.json', { ...settings, requestedModel: model, ...summarize(scoped, modelCases.get(model), timing), results: scoped });
    console.log(`Artifacts: ${directories.get(model)}`);
  }
  const summary = { ...settings, ...summarize(results, jobs.map(job => job.test), timing), results, modelDirectories: Object.fromEntries(directories) };
  await save(roundDirectory, 'summary.json', summary);
  console.log(`Round: ${roundDirectory}`);
  return summary;
}
