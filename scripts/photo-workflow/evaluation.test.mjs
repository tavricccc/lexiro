import { test } from 'vitest';
import assert from 'node:assert/strict';
import { schedule } from './scheduler.mjs';
import { parseCapture, summarize } from './metrics.mjs';

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
