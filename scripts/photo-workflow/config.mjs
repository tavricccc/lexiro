import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const taskOrder = ['photos', 'words', 'vocabulary', 'cloze', 'wordBank', 'discourse', 'reading', 'senses', 'explain'];
export function configuration(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    phase: { type: 'string' }, models: { type: 'string' }, tasks: { type: 'string', default: taskOrder.join(',') },
    'images-dir': { type: 'string' }, reference: { type: 'string' }, 'backend-module': { type: 'string' }, 'schema-module': { type: 'string' },
    transport: { type: 'string', default: 'codex' }, difficulty: { type: 'string', default: '2' },
    'batch-index': { type: 'string' }, 'batch-size': { type: 'string' }, concurrency: { type: 'string', default: '1' },
    'warm-first': { type: 'boolean', default: false }, tier: { type: 'string', default: 'lite' }, effort: { type: 'string' },
    'repair-from': { type: 'string', multiple: true }, feedback: { type: 'string' }, 'targeted-repair': { type: 'boolean', default: false },
    'revalidate-from': { type: 'string', multiple: true }, 'dry-run': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help) return { values };
  const replay = Boolean(values['revalidate-from']?.length);
  const phase = values.phase ?? (replay ? 'revalidation' : null);
  const models = [...new Set((values.models ?? 'gpt-6-luna,gpt-5.6-luna').split(','))];
  const selected = new Set(values.tasks.split(','));
  const difficulty = Number(values.difficulty);
  const batchIndex = values['batch-index'] === undefined ? null : Number(values['batch-index']);
  const batchSize = values['batch-size'] === undefined ? null : Number(values['batch-size']);
  const concurrency = Number(values.concurrency);
  if (!['baseline', 'tuned', ...(replay ? ['revalidation'] : [])].includes(phase) || (!replay && !values.reference) ||
    models.some(model => !['gpt-6-luna', 'gpt-5.6-luna'].includes(model)) || [...selected].some(task => !taskOrder.includes(task)) ||
    !['codex', 'responses'].includes(values.transport) || !['lite', 'thinking'].includes(values.tier) ||
    (values.effort && !['low', 'medium', 'high'].includes(values.effort)) || ![1, 2, 3].includes(difficulty) ||
    ![1, 2, 4].includes(concurrency) || (values.transport === 'responses' && concurrency > 2) ||
    (batchSize !== null && ![1, 4, 8, 16].includes(batchSize)) ||
    (batchIndex !== null && (!Number.isSafeInteger(batchIndex) || batchIndex < 0))) throw new Error('Invalid evaluation options; use --help.');
  if (!replay && phase === 'baseline' && !values['backend-module']) throw new Error('Baseline requires a frozen --backend-module.');
  if (!replay && selected.has('photos') && !values['images-dir']) throw new Error('Photos require --images-dir.');
  if (values['targeted-repair'] && !values['repair-from']?.length) throw new Error('Targeted repair requires an immutable previous run.');
  if (values['targeted-repair'] && concurrency !== 1) throw new Error('Native repair steps share ordered parent state; use --concurrency 1.');
  if (replay && (values['dry-run'] || values['repair-from'] || values.feedback || values['schema-module'])) throw new Error('Revalidation reads existing replies only; do not replace their schema or combine it with generation/repair planning.');
  if (!replay && values.transport === 'responses' && !values['dry-run'] && !process.env.OPENAI_API_KEY) throw new Error('Responses requires OPENAI_API_KEY; no transport fallback is used.');
  const root = resolve(import.meta.dirname, '../..');
  const frontend = resolve(process.env.LEXIRO_FRONTEND_PATH || join(root, '../lexiro'));
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  return { values: { ...values, phase }, models, selected, difficulty, batchIndex, batchSize, concurrency, replay, root, frontend,
    runId, startedAt: Date.now(), phaseRoot: join(root, 'artifacts/ai-quality', phase), cli: process.env.CODEX_PROMPT_EVAL_CLI || 'codex' };
}

export const help = `node scripts/evaluate-photo-workflow.mjs --phase baseline|tuned --models gpt-5.6-luna --tasks vocabulary --reference <lines-json>
  [--backend-module <frozen-v19-or-candidate-module>] [--schema-module <one-frozen-schema-for-A/B>] [--batch-size 1|4|8|16] [--batch-index <zero-based-batch>]
  [--concurrency 1|2|4] [--warm-first] [--tier lite|thinking] [--effort low|medium|high] [--difficulty 1|2|3]
  [--transport codex|responses] [--images-dir <five-jpg-directory>] [--repair-from <run> ...] [--feedback <json>] [--targeted-repair] [--dry-run]
node scripts/evaluate-photo-workflow.mjs --revalidate-from <immutable-run-directory> ...
Batch size changes vocabulary only. A specified size plans the complete pool unless --batch-index selects one probe.
Concurrency is the whole-round cap, including both models; 4 is CLI-only. Warm-first gates each model/task's first batch.
Dry runs and revalidation never invoke a model. CLI usage and first-text events do not establish API cost, cache hits, output-cap compliance or provider lanes.`;
