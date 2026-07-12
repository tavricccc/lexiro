import prompts from '@/lib/prompts'
import { DIFFICULTY_PROMPTS } from './difficulty-prompts'

export function buildImportPrompt(words: string, difficulty: number): string {
  const normalizedDifficulty = DIFFICULTY_PROMPTS[difficulty] ? difficulty : 2
  return prompts.generateWordSet
    .replace('{{WORDS}}', words.trim())
    .replace('{{DIFFICULTY_PROMPT}}', DIFFICULTY_PROMPTS[normalizedDifficulty])
    .replaceAll('{{DIFFICULTY_NUM}}', String(normalizedDifficulty))
}
