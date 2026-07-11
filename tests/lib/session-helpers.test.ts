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
  it('keeps the correct answer text after remapping ans', () => {
    const entry: SessionEntry = {
      originalIndex: 0,
      item: {
        id: '1',
        word: 'apple',
        pos: 'n.',
        meaning: '蘋果',
        example: 'I eat an apple.',
        question: {
          prompt: '_____ is a fruit.',
          opts: ['apple', 'banana', 'cherry', 'date'],
          ans: 0,
        },
      },
    }

    const shuffled = shuffleQuizEntry(entry)
    const correct = entry.item.question.opts[entry.item.question.ans]
    expect(shuffled.item.question.opts[shuffled.item.question.ans]).toBe(correct)
    expect(shuffled.item.question.opts).toHaveLength(4)
    expect(new Set(shuffled.item.question.opts)).toEqual(new Set(entry.item.question.opts))
  })
})
