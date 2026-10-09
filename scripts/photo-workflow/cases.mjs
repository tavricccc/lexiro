import { randomUUID } from 'node:crypto';
import { taskOrder } from './config.mjs';
import { wordsForSources, sourceIndicesForWords } from './sources.mjs';

export async function buildCases(config, modules, model, sources, words, units, photos) {
  const { values, selected, difficulty, batchSize, batchIndex } = config;
  const cases = [];
  const addStep = async (task, step, index, count, batchMode = 'production') => {
    const stepInput = JSON.parse(step.prompt);
    const parserWords = stepInput.sources && task !== 'senses' ? wordsForSources(modules, stepInput.sources, words) : null;
    const sourceIndices = parserWords ? sourceIndicesForWords(units, parserWords) : [];
    const input = { ...stepInput, model, tier: values.tier, session: randomUUID() };
    cases.push({ id: `${task}-${index + 1}`, task, sourceBasis: 'manual-reference', productionBatchIndex: index, productionBatchCount: count,
      batchMode, sourceIndices, requestUnitCount: step.count,
      parserContext: { input: stepInput, words: parserWords },
      prepared: await modules.backend.prepareGeneration(input, 'photo-quality-eval'), parse: step.parse, recover: step.recover });
  };
  for (const task of taskOrder.filter(task => selected.has(task))) {
    if (task === 'photos') {
      cases.push({ id: 'photos-1', task, sourceBasis: 'five-source-photos', sourceIndices: [], parserContext: { task },
        prepared: await modules.backend.prepareImages(photos.encoded.join('\n'), randomUUID(), 'photo-quality-eval', model, values.tier), parse: modules.parseOrganizedWordInput });
    } else if (task === 'words') {
      const steps = modules.wordTask(sources).steps;
      for (const [index, step] of steps.entries()) await addStep(task, step, index, steps.length);
    } else if (task === 'senses') {
      const supplements = words.map(word => ({ word: word.word, existing: word.senses.map(sense => ({ pos: sense.pos, meaningZh: sense.meaningZh })) }));
      const steps = modules.supplementTask(supplements, 2).steps;
      await addStep(task, steps[0], 0, steps.length);
    } else if (task === 'explain') {
      const items = words.slice(0, 5).map(word => ({ type: 'review', word: word.word, pos: word.senses[0].pos, meaning: word.senses[0].meaningZh, example: '' }));
      const prepared = await modules.backend.prepareGeneration({ kind: 'explain', raw: JSON.stringify({ items }), model, tier: values.tier, session: randomUUID() }, 'photo-quality-eval');
      cases.push({ id: 'explain-1', task, sourceBasis: 'manual-reference-review-cards', sourceIndices: [], parserContext: { task }, prepared,
        parse: text => { if (!text.trim()) throw new Error('Empty explanation.'); return { markdown: text }; } });
    } else if (task === 'vocabulary' && batchSize !== null) {
      const batches = modules.chunks(units, batchSize);
      if (batchIndex !== null && batchIndex >= batches.length) throw new Error(`Vocabulary batch index ${batchIndex} is outside ${batches.length} evaluation batches.`);
      for (const [index, batch] of batches.entries()) {
        if (batchIndex !== null && index !== batchIndex) continue;
        const steps = modules.questionTask(batch.map(unit => unit.word), task, difficulty).steps;
        if (steps.length !== 1) throw new Error('An evaluation vocabulary chunk must produce exactly one native task step.');
        await addStep(task, steps[0], index, batches.length, 'evaluation-vocabulary');
      }
    } else {
      // Complete passage/option groups retain the production packer and one native parser.
      const start = Math.floor(words.length / 2);
      const sample = task === 'wordBank' ? [...words.slice(start), ...words.slice(0, start)].slice(0, 10).map(word => ({ ...word, senses: [word.senses[0]] })) : words;
      const steps = modules.questionTask(sample, task, difficulty).steps;
      const index = (batchIndex ?? { vocabulary: 1, cloze: 0, wordBank: 0, discourse: 2, reading: 3 }[task]) % steps.length;
      await addStep(task, steps[index], index, steps.length);
    }
  }
  return cases;
}

export function parserForContext(modules, task, context) {
  if (task === 'photos') return { parse: modules.parseOrganizedWordInput };
  if (task === 'explain') return { parse: text => { if (!text.trim()) throw new Error('Empty explanation.'); return { markdown: text }; } };
  if (task === 'words') return modules.wordTask(modules.buildWordGenerationSources(context.input.raw)).steps[0];
  if (task === 'senses') {
    const grouped = new Map();
    for (const source of context.input.sources) {
      if (!grouped.has(source.word)) grouped.set(source.word, { word: source.word, existing: [] });
      grouped.get(source.word).existing.push({ pos: source.pos, meaningZh: source.meaningZh });
    }
    return modules.supplementTask([...grouped.values()], context.input.limit).steps[0];
  }
  const steps = modules.questionTask(context.words, task, context.input.difficulty).steps;
  if (steps.length !== 1) throw new Error('Saved parser context unexpectedly splits a complete request.');
  return steps[0];
}
