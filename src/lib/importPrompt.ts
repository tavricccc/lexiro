import type { WordGenerationSource } from '@/lib/word-generation'
import prompts, { fillPrompt } from '@/lib/prompts'
import { buildWordGenerationSources } from '@/lib/word-generation'

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
      ? '每個 sense 的 examples 必須恰好包含一個自然英文例句。'
      : '每個 sense 的 examples 必須是空陣列。',
    '{{OUTPUT_EXAMPLE}}': outputExample,
    '{{SOURCES}}': JSON.stringify(promptSources, null, 2),
  })
}
