import type { QuestionDifficulty } from '@/types'

export function isValidAnswerIndex(optionCount: number, answerIndex: number): boolean {
  return Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < optionCount
}

export type QuestionPromptIssue = 'fillBlank' | 'standard' | null

export function questionPromptIssue(questionStyle: 'standard' | 'fillBlank', prompt: string): QuestionPromptIssue {
  if (questionStyle === 'fillBlank' && !prompt.includes('_____'))
    return 'fillBlank'
  if (questionStyle === 'standard' && prompt.includes('_____'))
    return 'standard'
  return null
}

export function parseAnswerIndex(value: string, optionCount: number): number | null {
  const answerIndex = Number(value)
  return isValidAnswerIndex(optionCount, answerIndex) ? answerIndex : null
}

export function parseQuestionDifficulty(value: string): QuestionDifficulty | null {
  if (value === '1' || value === '2' || value === '3')
    return Number(value) as QuestionDifficulty
  return null
}
