import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parserForContext } from './cases.mjs';
import { referenceUnits, wordsForSources, sourceIndicesForWords, sourceKey } from './sources.mjs';
import { parseCapture } from './metrics.mjs';
import { save, digest } from './artifacts.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
function savedInput(request) {
  const input = request.request.input.findLast(input => input.role === 'user')?.content;
  if (typeof input !== 'string') throw new Error('Saved textual parser input is required.');
  return input;
}
function oldContext(modules, task, request, reference, sources) {
  if (['photos', 'explain'].includes(task)) return { task };
  const input = savedInput(request);
  if (task === 'words') {
    const match = input.match(/來源資料：(\[[^\r\n]*\])/u);
    if (!match) throw new Error('This saved words request has no replayable source envelope.');
    const rows = JSON.parse(match[1]);
    const selected = rows.map(row => sources.find(source => sourceKey(modules, source) === sourceKey(modules, row)));
    if (selected.some(source => !source)) throw new Error('Saved word source no longer matches its immutable reference.');
    return { input: { kind: task, raw: selected.map(source => source.raw).join('\n') } };
  }
  if (task === 'senses') throw new Error('Historical senses replies require saved generationInput/parserContext; original files remain unchanged.');
  const match = input.match(/Sources: (\[[^\r\n]*\])/u);
  const generation = request.generationInput ?? (match ? { kind: task, difficulty: request.difficulty, sources: JSON.parse(match[1]) } : JSON.parse(input));
  return { input: generation, words: wordsForSources(modules, generation.sources, reference.words) };
}

export function historicalWordBankWithoutRef(modules, task, request, raw) {
  if (task !== 'wordBank' || modules.questionContract !== 'single-pass-v3' ||
    request.request.text?.format?.schema?.properties?.blanks?.items?.required?.includes('ref')) return false;
  let data;
  try { data = JSON.parse(modules.extractJsonText(raw)); }
  catch { return false; } // Malformed replies still go through the native content-failure path.
  return Array.isArray(data?.blanks) && data.blanks.some(blank =>
    blank !== null && typeof blank === 'object' && !Array.isArray(blank) && !Object.hasOwn(blank, 'ref'));
}

async function replayCase(modules, directory, id, parents) {
  const [request, metrics, reference] = await Promise.all([json(join(directory, `${id}-request.json`)), json(join(directory, `${id}-metrics.json`)), json(join(directory, 'reference.json'))]);
  const sources = reference.sources ?? modules.buildWordGenerationSources(modules.parseOrganizedWordInput(JSON.stringify(reference.reference)).join('\n'));
  const units = referenceUnits(modules, sources, reference.words);
  const context = request.parserContext ?? oldContext(modules, metrics.task, request, reference, sources);
  const native = context.nativeRepair ?? (request.repair?.productionStepId ? { parentDirectory: request.repair.previousDirectory, parentCaseId: request.repair.previousCaseId, stepId: request.repair.productionStepId } : null);
  let parser;
  if (native) {
    const key = `${native.parentDirectory}/${native.parentCaseId}`;
    if (!parents.has(key)) {
      const parent = await replayCase(modules, native.parentDirectory, native.parentCaseId, parents);
      const raw = await readFile(join(native.parentDirectory, `${native.parentCaseId}-response.txt`), 'utf8');
      const recovered = parent.test.recover?.(raw);
      if (!recovered) throw new Error('The current native parser cannot reconstruct this saved fixed-parent repair.');
      parents.set(key, recovered.remaining);
    }
    parser = parents.get(key).find(step => step.id === native.stepId);
    if (!parser) throw new Error(`Native repair step ${native.stepId} is no longer present.`);
  } else parser = parserForContext(modules, metrics.task, context);
  return { request, original: metrics, sources, units, test: { id, task: metrics.task, ...parser,
    sourceIndices: request.sourceIndices ?? (context.words ? sourceIndicesForWords(units, context.words) : []) } };
}

export async function revalidate(config, modules) {
  const roundDirectory = join(config.phaseRoot, 'runs', config.runId);
  await mkdir(roundDirectory, { recursive: true });
  const reports = [];
  for (const path of config.values['revalidate-from']) {
    const directory = resolve(path);
    const summary = await json(join(directory, 'summary.json'));
    const output = join(roundDirectory, `${summary.requestedModel}-${digest(directory).slice(0, 8)}`);
    await mkdir(output, { recursive: true });
    const available = new Set((await readdir(directory)).filter(name => name.endsWith('-metrics.json')).map(name => name.slice(0, -'-metrics.json'.length)));
    const cases = summary.results.filter(result => available.has(result.id));
    if (!cases.length) throw new Error('No saved model responses matched; a dry-run plan cannot be revalidated as a result.');
    const parents = new Map();
    const results = [];
    for (const original of cases) {
      if (original.status === 'SKIPPED') { results.push({ id: original.id, status: 'SKIPPED', skipReason: original.skipReason }); continue; }
      const saved = await json(join(directory, `${original.id}-request.json`));
      const raw = await readFile(join(directory, `${original.id}-response.txt`), 'utf8');
      const legacyPassage = ['cloze', 'wordBank', 'discourse', 'reading'].includes(original.task) && modules.questionContract === 'single-pass-v3' && /^lexiro-questions-20261009-v(?:19|20|21)$/.test(saved.cacheKey);
      const missingHistoricalRef = historicalWordBankWithoutRef(modules, original.task, saved, raw);
      if (!original.error && (legacyPassage || missingHistoricalRef)) {
        const result = { id: original.id, task: original.task, status: 'INCOMPATIBLE_CONTRACT', sourceResponseSha256: digest(raw),
          savedContract: legacyPassage ? 'single-pass-v2 passage raw' : 'single-pass-v3 WordBank without required blank.ref', parserContract: modules.questionContract,
          note: 'Historical raw-contract mismatch; not scored as model semantic or content failure.' };
        await save(output, `${original.id}-revalidation.json`, result); results.push(result); continue;
      }
      const replay = await replayCase(modules, directory, original.id, parents);
      const analysis = parseCapture(modules, replay.test, { raw, error: original.error ?? null }, replay.sources, replay.units);
      const result = { id: original.id, task: original.task, ...analysis.metrics, sourceResponseSha256: digest(raw),
        originalParseError: original.parseError ?? null, originalTransportError: original.error ?? null, originalDurationMs: original.durationMs,
        schemaSha256: replay.request.schemaSha256 ?? digest(JSON.stringify(replay.request.request.text?.format?.schema ?? null)) };
      await save(output, `${original.id}-revalidation.json`, { ...result, parsed: analysis.parsed, recovery: analysis.recovery });
      results.push(result);
    }
    await save(output, 'summary.json', { sourceDirectory: directory, requestedModel: summary.requestedModel, frontendParser: modules.frontendVersion,
      originalRun: summary.immutableRun, revalidationRun: config.runId, results,
      method: 'Original request/schema/response/metrics are read only. The current native parser is reused; no backend preparation, model calls or recovery requests.' });
    reports.push({ sourceDirectory: directory, output, results });
    console.log(`Revalidation: ${output}`);
  }
  await save(roundDirectory, 'summary.json', { revalidationRun: config.runId, frontendParser: modules.frontendVersion, modelRequests: 0, reports });
  return reports;
}
