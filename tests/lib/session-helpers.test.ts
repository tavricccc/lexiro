import type { SessionEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { createDebouncedSaver } from '@/lib/persist'
import { shuffleQuizEntry } from '@/lib/shuffle'

describe('createDebouncedSaver', () => {
  it('coalesces multiple schedule calls into one write after delay', async () => {
    let count = 0
    const saver = createDebouncedSaver(() => {
      count += 1
    }, 20)
    saver.schedule()
    saver.schedule()
    saver.schedule()
    expect(count).toBe(0)
    await new Promise(r => setTimeout(r, 40))
    expect(count).toBe(1)
  })

  it('flush writes immediately and cancels pending', async () => {
    let count = 0
    const saver = createDebouncedSaver(() => {
      count += 1
    }, 50)
    saver.schedule()
    saver.flush()
    expect(count).toBe(1)
    await new Promise(r => setTimeout(r, 70))
    expect(count).toBe(1)
  })
})

describe('shuffleQuizEntry', () => {
  it('keeps the correct answer text after remapping answerIndex', () => {
    const entry: SessionEntry = {
      originalIndex: 0,
      item: {
        id: '1',
        wordKey: 'apple',
        word: 'apple',
        pos: 'n.',
        meaning: '蘋果',
        examples: ['I eat an apple.'],
        example: 'I eat an apple.',
      },
      question: {
        questionId: 'question-apple',
        questionType: 'fillBlank',
        difficulty: 1,
        prompt: '_____ is a fruit.',
        options: ['apple', 'banana', 'cherry', 'date'],
        answerIndex: 0,
      },
    }

    const shuffled = shuffleQuizEntry(entry)
    const correct = entry.question!.options[entry.question!.answerIndex]
    expect(shuffled.question!.options[shuffled.question!.answerIndex]).toBe(correct)
    expect(shuffled.question!.options).toHaveLength(4)
    expect(new Set(shuffled.question!.options)).toEqual(new Set(entry.question!.options))
  })
})
