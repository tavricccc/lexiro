import prompts from '@/lib/prompts'

export function buildImportPrompt(words: string): string {
  return prompts.generateWordSet
    .replace('{{WORDS}}', words.trim())
}
