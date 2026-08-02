import type { LibraryQuestion, MultipleChoiceQuestion, ReadingPack } from '@/types'
import { parseLibraryImportValue } from './library-import'
import { isValidAnswerIndex, questionPromptIssue } from './question-shape'
import { containsHan } from './validation'

export type QuestionValidationCode = 'required' | 'englishOnly' | 'fillBlankPrompt' | 'standardPrompt'

export function validateMultipleChoiceDraft(question: MultipleChoiceQuestion): QuestionValidationCode | null {
  const prompt = question.prompt.trim()
  const options = question.options.map(option => option.trim())
  if (!question.wordKey.trim() || !question.senseId.trim() || !prompt || options.length !== 4 || options.some(option => !option) || !isValidAnswerIndex(options.length, question.answerIndex))
    return 'required'
  if (containsHan(prompt) || options.some(containsHan))
    return 'englishOnly'
  const promptIssue = questionPromptIssue(question.questionStyle, prompt)
  if (promptIssue === 'fillBlank')
    return 'fillBlankPrompt'
  if (promptIssue === 'standard')
    return 'standardPrompt'
  return null
}

export function validateReadingDraft(question: ReadingPack): QuestionValidationCode | null {
  const title = question.title.trim()
  const passage = question.passage.trim()
  if (!title || !passage || !question.questions.length)
    return 'required'
  for (const child of question.questions) {
    const prompt = child.prompt.trim()
    const options = child.options.map(option => option.trim())
    if (!child.wordKey.trim() || !child.senseId.trim() || !prompt || options.length !== 4 || options.some(option => !option) || !isValidAnswerIndex(options.length, child.answerIndex))
      return 'required'
    if (containsHan(prompt) || options.some(containsHan))
      return 'englishOnly'
  }
  if (containsHan(title) || containsHan(passage))
    return 'englishOnly'
  return null
}

export function isCanonicalQuestion(question: LibraryQuestion): boolean {
  const parsed = parseLibraryImportValue({ schemaVersion: 1, kind: 'questions', questions: [question] }, { requireEnglish: true })
  return parsed.valid
}
