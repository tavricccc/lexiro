import type { WordGenerationSource } from '@/lib/word-generation'
import prompts from '@/lib/prompts'
import { buildWordGenerationSources } from '@/lib/word-generation'

export function buildImportPrompt(rawInput: string, sources: WordGenerationSource[] = buildWordGenerationSources(rawInput), generateExamples = false): string {
  return prompts.generateWordSet
    .replace('{{EXAMPLES_RULE}}', generateExamples
      ? '- 使用者已選擇產生例句；每個 sense 必須提供一個自然、全英文的例句。'
      : '- 使用者未選擇產生例句；每個 sense 的 examples 必須是空陣列。')
    .replace('{{INPUT}}', rawInput.trim())
    .replace('{{SOURCES}}', JSON.stringify(sources, null, 2))
}
