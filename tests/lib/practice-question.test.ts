import type { MultipleChoiceQuestion, ReadingChildQuestion, ReadingPack } from '@/types'
import { describe, expect, it } from 'vitest'
import { toPracticeQuestion, toReadingPracticeQuestion } from '@/lib/practice-question'

describe('practice question projections', () => {
  it('projects canonical multiple-choice fields without sharing the options array', () => {
    const question: MultipleChoiceQuestion = {
      id: 'question-1',
      fingerprint: 'fingerprint-1',
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: 'run',
      senseId: 'sense-run',
      difficulty: 2,
      prompt: 'Choose run.',
      options: ['run', 'walk', 'sit', 'stand'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }

    const projected = toPracticeQuestion(question)
    expect(projected).toMatchObject({ questionId: 'question-1', questionType: 'standard', options: question.options, answerIndex: 0 })
    expect(projected.options).not.toBe(question.options)
  })

  it('uses the reading pack difficulty for each child', () => {
    const pack = { difficulty: 3 } as Pick<ReadingPack, 'difficulty'>
    const child: ReadingChildQuestion = {
      id: 'child-1',
      kind: 'multipleChoice',
      prompt: 'Which word?',
      options: ['run', 'walk', 'sit', 'stand'],
      answerIndex: 1,
      wordKey: 'run',
      senseId: 'sense-run',
    }

    expect(toReadingPracticeQuestion(pack, child)).toEqual({
      questionId: 'child-1',
      questionType: 'reading',
      difficulty: 3,
      prompt: 'Which word?',
      options: ['run', 'walk', 'sit', 'stand'],
      answerIndex: 1,
    })
  })
})
