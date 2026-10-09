import { reasonText } from './artifacts.mjs';

const questionChildren = items => items.flatMap(item => item.kind === 'reading' ? item.questions : [item]);
export function acceptedSourceIndices(units, items) {
  const keys = new Set(questionChildren(items).map(item => JSON.stringify([item.wordKey, item.senseId])));
  return units.filter(unit => keys.has(JSON.stringify([unit.word.wordKey, unit.word.senses[0].id]))).map(unit => unit.index);
}
export function parseCapture(modules, test, capture, sources, units) {
  const started = Date.now();
  let parsed = null, parseError = null, recovery = null, recoveryError = null, photoCoverage = null;
  if (!capture.error) {
    try {
      parsed = test.parse(capture.raw);
      if (test.task === 'photos') {
        const expected = new Set(sources.map(source => modules.normalizeWordKey(source.word)));
        const actual = new Set(modules.buildWordGenerationSources(parsed.join('\n')).map(source => modules.normalizeWordKey(source.word)));
        photoCoverage = { expectedHeadwords: expected.size, actualHeadwords: actual.size, missing: [...expected].filter(word => !actual.has(word)), extra: [...actual].filter(word => !expected.has(word)), note: 'Headwords only; not every meaning, part of speech or correction.' };
      }
    } catch (reason) {
      parseError = reasonText(reason);
      if (test.recover) {
        try { recovery = test.recover(capture.raw); }
        catch (reason) { recoveryError = reasonText(reason); }
      }
    }
  }
  const retained = Array.isArray(parsed) ? parsed : recovery?.items ?? [];
  const retainedUnits = retained.length;
  const remaining = recovery?.remaining.map(step => ({ id: step.id, count: step.count, stagedQuestions: step.stagedQuestions ?? null })) ?? [];
  const stagedChildren = Math.max(0, ...remaining.map(step => step.stagedQuestions ?? 0));
  const status = capture.error ? 'TRANSPORT_FAIL' : parseError ? retainedUnits ? 'PARTIAL' : 'CONTENT_FAIL' : 'PARSED';
  return { parsed, recovery: recovery ? { items: recovery.items, completed: recovery.completed, remaining } : null, metrics: {
    status, parseError, recoveryError, acceptedResult: parsed !== null && (!Array.isArray(parsed) || parsed.length > 0), parsedCount: Array.isArray(parsed) ? parsed.length : null,
    retainedUnits, retainedQuestionCount: questionChildren(retained).length, remainingUnits: remaining.length,
    retainedSourceIndices: acceptedSourceIndices(units, retained), plannedSourceIndices: test.sourceIndices ?? [],
    stagedChildren, parseDurationMs: Date.now() - started,
    ...(recovery ? { recovery: { retainedItems: recovery.items.length, completed: recovery.completed, remaining } } : {}),
    ...(photoCoverage ? { photoCoverage } : {}),
    retentionBasis: 'Saveable application records from the native parser/recovery; staged passage children are not counted as delivered groups. No recovery requests are executed.',
  } };
}
const aggregateField = (results, usageKey, field) => {
  const values = results.map(result => result[usageKey]?.[field]);
  return { knownBatches: values.filter(Number.isFinite).length, total: values.every(Number.isFinite) && values.length ? values.reduce((sum, value) => sum + value, 0) : null };
};
export function summarize(results, planned, timing) {
  const executed = results.filter(result => !result.dryRun && result.status !== 'SKIPPED');
  const first = predicate => {
    const values = executed.filter(predicate).map(result => result.completedAtMs);
    return values.length ? Math.min(...values) : null;
  };
  const fromRoundStart = predicate => {
    const value = first(predicate);
    return value === null ? null : value + timing.executionStartOffsetMs;
  };
  const coverage = Object.fromEntries([...new Set(planned.map(test => test.task))].map(task => {
    const scope = results.filter(result => result.task === task);
    const expected = [...new Set(planned.filter(test => test.task === task).flatMap(test => test.sourceIndices ?? []))].sort((a, b) => a - b);
    const retained = [...new Set(scope.flatMap(result => result.retainedSourceIndices ?? []))].sort((a, b) => a - b);
    return [task, { plannedSourceIndices: expected, retainedSourceIndices: retained, missingPlannedSources: expected.filter(index => !retained.includes(index)),
      retainedUnits: scope.reduce((sum, result) => sum + (result.retainedUnits ?? 0), 0), remainingUnits: scope.reduce((sum, result) => sum + (result.remainingUnits ?? 0), 0) }];
  }));
  return { ...timing, firstReplyMs: first(result => result.replyCharacters > 0),
    firstAcceptedBatchMs: first(result => result.status === 'PARSED' && result.acceptedResult),
    firstRetainedResultMs: first(result => result.retainedUnits > 0),
    firstReplyFromRoundStartMs: fromRoundStart(result => result.replyCharacters > 0),
    firstAcceptedBatchFromRoundStartMs: fromRoundStart(result => result.status === 'PARSED' && result.acceptedResult),
    firstRetainedResultFromRoundStartMs: fromRoundStart(result => result.retainedUnits > 0),
    plannedCases: planned.length, completedCases: executed.length, skippedCases: results.filter(result => result.status === 'SKIPPED').length,
    counts: Object.fromEntries(['PARSED', 'PARTIAL', 'CONTENT_FAIL', 'TRANSPORT_FAIL', 'SKIPPED', 'PLANNED'].map(status => [status, results.filter(result => result.status === status).length])),
    coverage,
    cliTokens: Object.fromEntries(['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens'].map(field => [field, aggregateField(executed, 'cliUsage', field)])),
    apiTokens: Object.fromEntries(['input', 'cached', 'cacheWrite', 'output'].map(field => [field, aggregateField(executed, 'apiTokens', field)])),
    timingBasis: 'Milliseconds from the round execution start, including CLI startup, parsing and persistence. First CLI text may be a completed message; it is not provider TTFT.',
  };
}
