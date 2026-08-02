import type { SessionEntry, StudyWord } from '@/types'
import { describe, expect, it } from 'vitest'
import { balancedQuotas, takeQuestionEntries } from '@/lib/session-selection'

const item: StudyWord = {
  id: 'sense-1',
  wordKey: 'abandon',
  word: 'abandon',
  pos: 'v.',
  meaning: '放棄',
  examples: [],
  example: '',
}

function entry(questionId: string, itemId = item.id): SessionEntry {
  return {
    item: { ...item, id: itemId },
    question: { questionId, questionType: 'standard', difficulty: 1, prompt: 'Choose.', options: ['a', 'b', 'c', 'd'], answerIndex: 0 },
    originalIndex: 0,
  }
}

describe('session selection', () => {
  it('distributes a target across available pools without exceeding capacity', () => {
    expect(balancedQuotas(10, [100, 100, 100])).toEqual([4, 3, 3])
    expect(balancedQuotas(10, [1, 2, 100])).toEqual([1, 2, 7])
  })

  it('uses formal question ids and only repeats a sense after unique senses are exhausted', () => {
    const selected = takeQuestionEntries([
      entry('question-1'),
      entry('question-2'),
      entry('question-3', 'sense-2'),
      { item, originalIndex: 0 },
    ], 3, new Set(), new Set())

    expect(selected).toHaveLength(3)
    expect(selected.every(item => item.question?.questionId)).toBe(true)
    expect(new Set(selected.map(item => item.question?.questionId)).size).toBe(3)
    expect(new Set(selected.map(item => item.item.id))).toEqual(new Set(['sense-1', 'sense-2']))
  })
})
