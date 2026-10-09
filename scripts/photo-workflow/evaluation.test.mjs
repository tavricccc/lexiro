import { test } from 'vitest';
import assert from 'node:assert/strict';
import { schedule } from './scheduler.mjs';
import { parseCapture, summarize } from './metrics.mjs';
import { buildCases, parserForContext } from './cases.mjs';
import { historicalWordBankWithoutRef } from './replay.mjs';

test('one global bound preserves each first-batch barrier and then overlaps work', async () => {
  const jobs = ['a', 'b'].flatMap(model => [0, 1, 2].map(index => ({ model, groupKey: model, index })));
  const events = [];
  let active = 0, maximum = 0;
  const run = await schedule(jobs, { concurrency: 2, warmFirst: true, execute: async job => {
    events.push(`start:${job.model}:${job.index}`); maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 10));
    events.push(`end:${job.model}:${job.index}`); active--; return { error: null };
  } });
  assert.equal(run.maximumActive, 2); assert.equal(maximum, 2);
  for (const model of ['a', 'b']) assert.ok(events.indexOf(`start:${model}:1`) > events.indexOf(`end:${model}:0`));
  assert.equal(run.outcomes.filter(outcome => outcome.result).length, 6);
});

test('a transport failure stops that model without dispatching its queued batches', async () => {
  const jobs = ['bad', 'ok'].flatMap(model => [0, 1, 2].map(index => ({ model, groupKey: model, index })));
  const called = [];
  const run = await schedule(jobs, { concurrency: 2, warmFirst: true, execute: async job => {
    called.push(`${job.model}/${job.index}`); return { error: job.model === 'bad' ? 'CLI timed out' : null };
  } });
  assert.deepEqual(called.filter(value => value.startsWith('bad/')), ['bad/0']);
  assert.equal(run.outcomes.filter(outcome => outcome.skipped).length, 2);
  assert.deepEqual(run.stoppedModels, ['bad']);
});

test('partial native recovery contributes retained source coverage and first saveable result', () => {
  const units = [0, 1, 2].map(index => ({ index, word: { wordKey: `w${index}`, senses: [{ id: `s${index}` }] } }));
  const retained = [0, 2].map(index => ({ wordKey: `w${index}`, senseId: `s${index}`, kind: 'multipleChoice' }));
  const step = { task: 'vocabulary', sourceIndices: [0, 1, 2], parse: () => { throw new Error('one item missing'); },
    recover: () => ({ items: retained, completed: 2, remaining: [{ id: 's1', count: 1 }] }) };
  const analysis = parseCapture({}, step, { raw: '{}', error: null }, [], units);
  assert.equal(analysis.metrics.status, 'PARTIAL'); assert.equal(analysis.metrics.retainedUnits, 2);
  assert.deepEqual(analysis.metrics.retainedSourceIndices, [0, 2]);
  const summary = summarize([{ ...analysis.metrics, task: 'vocabulary', completedAtMs: 50 }], [step], { executionStartOffsetMs: 7 });
  assert.equal(summary.firstRetainedResultMs, 50); assert.equal(summary.firstAcceptedBatchMs, null);
  assert.equal(summary.firstRetainedResultFromRoundStartMs, 57);
  assert.deepEqual(summary.coverage.vocabulary.missingPlannedSources, [1]);
});

test('an evaluation override and replay retain sixteen sources while production still packs four', async () => {
  const words = Array.from({ length: 16 }, (_, index) => ({ word: `w${index}`, wordKey: `w${index}`,
    senses: [{ id: `s${index}`, pos: 'n.', meaningZh: `詞${index}`, examples: [] }] }));
  const units = words.map((word, index) => ({ word, index }));
  const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
  const step = batch => ({ count: batch.length, prompt: JSON.stringify({ kind: 'vocabulary', difficulty: 3,
    sources: batch.map((word, index) => ({ ref: `s${index + 1}`, word: word.word, pos: 'n.', meaningZh: word.senses[0].meaningZh })) }),
    parse: raw => JSON.parse(raw).items, recover: () => null });
  const modules = { chunks, normalizeWordKey: word => word.toLowerCase(),
    questionTask: batch => ({ steps: chunks(batch, 4).map(step) }),
    questionBatchTask: batch => ({ steps: [step(batch)] }),
    backend: { prepareGeneration: async input => ({ request: input }) } };
  const config = { values: { tier: 'thinking' }, selected: new Set(['vocabulary']), difficulty: 3, batchSize: 16, batchIndex: null };
  const planned = await buildCases(config, modules, 'gpt-5.6-luna', [], words, units, null);
  assert.equal(planned.length, 1);
  assert.equal(planned[0].prepared.request.sources.length, 16);
  assert.deepEqual(planned[0].sourceIndices, units.map(unit => unit.index));
  const restored = parserForContext(modules, 'vocabulary', planned[0].parserContext);
  assert.equal(JSON.parse(restored.prompt).sources.length, 16);
  assert.equal(restored.parse(JSON.stringify({ items: words })).length, 16);
  const production = await buildCases({ ...config, batchSize: null }, modules, 'gpt-5.6-luna', [], words, units, null);
  assert.equal(production[0].prepared.request.sources.length, 4);
  assert.equal(production[0].batchMode, 'production');
});

test('historical WordBank missing ref is distinct from a new missing or unknown ref', () => {
  const modules = { questionContract: 'single-pass-v3', extractJsonText: text => text };
  const request = required => ({ request: { text: { format: { schema: { properties: { blanks: { items: { required } } } } } } } });
  const old = request(['usage', 'answer']), current = request(['ref', 'usage', 'answer']);
  assert.equal(historicalWordBankWithoutRef(modules, 'wordBank', old, JSON.stringify({ blanks: [{ usage: 'a plot', answer: 'plot' }] })), true);
  assert.equal(historicalWordBankWithoutRef(modules, 'wordBank', current, JSON.stringify({ blanks: [{ usage: 'a plot', answer: 'plot' }] })), false);
  assert.equal(historicalWordBankWithoutRef(modules, 'wordBank', old, JSON.stringify({ blanks: [{ ref: 'unknown', usage: 'a plot', answer: 'plot' }] })), false);
  assert.equal(historicalWordBankWithoutRef(modules, 'wordBank', old, JSON.stringify({ blanks: [{ ref: null, usage: 'a plot', answer: 'plot' }] })), false);
});
