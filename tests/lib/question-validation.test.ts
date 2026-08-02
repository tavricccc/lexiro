import type { MultipleChoiceQuestion, ReadingPack } from '@/types'
import { describe, expect, it } from 'vitest'
import { isValidAnswerIndex, parseAnswerIndex, parseQuestionDifficulty, questionPromptIssue } from '@/lib/question-shape'
import { isCanonicalQuestion, validateMultipleChoiceDraft, validateReadingDraft } from '@/lib/question-validation'

const multipleChoice: MultipleChoiceQuestion = {
  id: 'question-1',
  fingerprint: 'fingerprint-1',
  kind: 'multipleChoice',
  questionStyle: 'standard',
  wordKey: 'abandon',
  senseId: 'sense-1',
  difficulty: 1,
  prompt: 'Which word means leave?',
  options: ['abandon', 'keep', 'start', 'build'],
  answerIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const reading: ReadingPack = {
  id: 'reading-1',
  fingerprint: 'fingerprint-reading',
  kind: 'reading',
  difficulty: 2,
  title: 'A short story',
  passage: 'The story has a clear beginning and end.',
  wordKeys: ['abandon'],
  questions: [{
    id: 'child-1',
    kind: 'multipleChoice',
    prompt: 'What does the story have?',
    options: ['A clear beginning and end.', 'No characters.', 'Only a title.', 'No ending.'],
    answerIndex: 0,
    wordKey: 'abandon',
    senseId: 'sense-1',
  }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('question validation', () => {
  it('shares question input parsing rules across editors', () => {
    expect(isValidAnswerIndex(4, 3)).toBe(true)
    expect(isValidAnswerIndex(4, 4)).toBe(false)
    expect(parseAnswerIndex('2', 4)).toBe(2)
    expect(parseAnswerIndex('4', 4)).toBeNull()
    expect(parseQuestionDifficulty('3')).toBe(3)
    expect(parseQuestionDifficulty('all')).toBeNull()
    expect(questionPromptIssue('fillBlank', '_____ the plan.')).toBeNull()
    expect(questionPromptIssue('standard', '_____ the plan.')).toBe('standard')
  })

  it('shares multiple-choice draft rules', () => {
    expect(validateMultipleChoiceDraft(multipleChoice)).toBeNull()
    expect(validateMultipleChoiceDraft({ ...multipleChoice, prompt: '_____ the plan.', questionStyle: 'standard' })).toBe('standardPrompt')
    expect(validateMultipleChoiceDraft({ ...multipleChoice, prompt: '選一個答案' })).toBe('englishOnly')
    expect(validateMultipleChoiceDraft({ ...multipleChoice, options: ['abandon', '', 'start', 'build'] })).toBe('required')
  })

  it('shares reading draft rules', () => {
    expect(validateReadingDraft(reading)).toBeNull()
    expect(validateReadingDraft({ ...reading, title: '中文標題' })).toBe('englishOnly')
    expect(validateReadingDraft({ ...reading, questions: [{ ...reading.questions[0], options: ['one', 'two'] }] })).toBe('required')
  })

  it('uses the canonical parser for final question validity', () => {
    expect(isCanonicalQuestion(multipleChoice)).toBe(true)
    expect(isCanonicalQuestion({ ...multipleChoice, options: ['one', 'two'] })).toBe(false)
    expect(isCanonicalQuestion(reading)).toBe(true)
  })
})
