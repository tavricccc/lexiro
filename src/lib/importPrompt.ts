import type { WordGenerationSource } from './word-generation'
import prompts, { fillPrompt, JSON_ONLY } from './prompts'
import { buildWordGenerationSources } from './word-generation'

export function buildImportPrompt(rawInput: string, sources: WordGenerationSource[] = buildWordGenerationSources(rawInput), generateExamples = false): string {
  const promptSources = sources.map(({ sourceRef, word, raw }) => ({
    sourceRef,
    word,
    ...(raw.trim() !== word ? { input: raw } : {}),
  }))
  const outputExample = generateExamples
    ? JSON.stringify({ words: [{ sourceRef: 'source-1', senses: [{ pos: 'v.', meaningZh: '適應；使適應', examples: ['We adapt quickly.'] }] }] })
    : JSON.stringify({ words: [{ sourceRef: 'source-1', senses: [{ pos: 'v.', meaningZh: '適應；使適應', examples: [] }] }] })
  return fillPrompt(prompts.generateWordSet, {
    '{{EXAMPLES_RULE}}': generateExamples
      ? 'examples 恰好 1 個自然、簡短的英文例句。'
      : 'examples 必須是空陣列。',
    '{{OUTPUT_EXAMPLE}}': outputExample,
    '{{JSON_ONLY}}': JSON_ONLY,
    '{{SOURCES}}': JSON.stringify(promptSources),
  })
}
