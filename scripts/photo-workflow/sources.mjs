export const sourceKey = (modules, source) => JSON.stringify([modules.normalizeWordKey(source.word), source.pos ?? source.posHint, source.meaningZh ?? source.hint]);
export function referenceWords(modules, sources) {
  const drafts = sources.map((source, index) => {
    if (!source.posHint || !source.hint) throw new Error(`Reference row ${index + 1} requires a canonical part of speech and one Chinese meaning.`);
    return { word: source.word, senses: [{ id: `reference-${index + 1}`, pos: source.posHint, meaning: source.hint, examples: [], supplementary: false }] };
  });
  const order = new Map();
  sources.forEach((source, index) => { const key = modules.normalizeWordKey(source.word); if (!order.has(key)) order.set(key, index); });
  return modules.mergeWordDrafts(drafts).map(modules.itemToWordEntry).sort((a, b) => order.get(a.wordKey) - order.get(b.wordKey));
}
export function referenceUnits(modules, sources, words) {
  return sources.map((source, index) => {
    const word = words.find(word => word.wordKey === modules.normalizeWordKey(source.word));
    const sense = word?.senses.find(sense => sourceKey(modules, { word: word.word, pos: sense.pos, meaningZh: sense.meaningZh }) === sourceKey(modules, source));
    if (!sense) throw new Error(`Reference row ${index + 1} did not retain its stated meaning.`);
    return { index, sourceRef: source.sourceRef, word: { ...word, senses: [sense] } };
  });
}
export function wordsForSources(modules, requestSources, words) {
  return requestSources.map(source => {
    const word = words.find(word => word.wordKey === modules.normalizeWordKey(source.word));
    const sense = word?.senses.find(sense => sourceKey(modules, { word: word.word, pos: sense.pos, meaningZh: sense.meaningZh }) === sourceKey(modules, source));
    if (!sense) throw new Error(`Saved source ${source.word}/${source.meaningZh} is absent from the immutable reference.`);
    return { ...word, senses: [sense] };
  });
}
export function sourceIndicesForWords(units, words) {
  const keys = new Set(words.flatMap(word => word.senses.map(sense => JSON.stringify([word.wordKey, sense.id]))));
  return units.filter(unit => keys.has(JSON.stringify([unit.word.wordKey, unit.word.senses[0].id]))).map(unit => unit.index);
}
