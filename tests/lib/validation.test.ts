import { describe, expect, it } from 'vitest'
import {
  createBlankEditorItem,
  createEditorItem,
  createEditorItems,
  normalizeExportPayload,
  normalizeItem,
  normalizeSession,
  normalizeSet,
  toSessionEntries,
} from '@/lib/validation'

describe('normalizeItem', () => {
  const validItem = {
    word: 'apple',
    meaning: '蘋果',
    example: 'I eat an apple.',
  }

  it('returns a normalized item for valid input', () => {
    const result = normalizeItem(validItem, 0)
    expect(result.word).toBe('apple')
    expect(result.meaning).toBe('蘋果')
    expect(result.example).toBe('I eat an apple.')
    expect(result.id).toBeTruthy()
  })

  it('generates a fallback id when id is missing', () => {
    const result = normalizeItem(validItem, 2)
    expect(result.id).toBeTruthy()
  })

  it('uses the provided id and trims it', () => {
    const result = normalizeItem({ ...validItem, id: '  my-id  ' }, 0)
    expect(result.id).toBe('my-id')
  })

  it('defaults pos to empty string when missing', () => {
    const result = normalizeItem(validItem, 0)
    expect(result.pos).toBe('')
  })

  it('uses provided pos and trims it', () => {
    const result = normalizeItem({ ...validItem, pos: '  n.  ' }, 0)
    expect(result.pos).toBe('n.')
  })

  it('throws when input is not an object', () => {
    expect(() => normalizeItem(null, 0)).toThrow('資料格式錯誤')
    expect(() => normalizeItem([], 0)).toThrow('資料格式錯誤')
  })

  it('throws when word is missing', () => {
    const { word: _, ...rest } = validItem
    expect(() => normalizeItem(rest, 0)).toThrow('缺少 word')
  })

  it('throws when word is empty', () => {
    expect(() => normalizeItem({ ...validItem, word: '' }, 0)).toThrow('缺少 word')
  })

  it('throws when meaning is missing', () => {
    const { meaning: _, ...rest } = validItem
    expect(() => normalizeItem(rest, 0)).toThrow('缺少 meaning')
  })

  it('allows example to be completed later', () => {
    const { example: _, ...rest } = validItem
    expect(normalizeItem(rest, 0).example).toBe('')
  })
})

describe('normalizeSet', () => {
  const validSet = {
    setName: 'Fruits',
    items: [
      {
        word: 'apple',
        meaning: '蘋果',
        example: 'I eat an apple.',
      },
    ],
  }

  it('returns a normalized set for valid input', () => {
    const result = normalizeSet(validSet)
    expect(result.setName).toBe('Fruits')
    expect(result.items).toHaveLength(1)
    expect(result.id).toBeDefined()
  })

  it('generates a fallback id when id is missing', () => {
    const result = normalizeSet(validSet)
    expect(typeof result.id).toBe('string')
    expect(result.id).not.toBe('')
  })

  it('uses the provided fallbackId as id', () => {
    const result = normalizeSet(validSet, 'custom-fallback')
    expect(result.id).toBe('custom-fallback')
  })

  it('uses provided id and trims it', () => {
    const result = normalizeSet({ ...validSet, id: '  my-set  ' })
    expect(result.id).toBe('my-set')
  })

  it('generates a fallback setName when missing', () => {
    const { setName: _, ...rest } = validSet
    const result = normalizeSet(rest)
    expect(result.setName).toMatch(/^單字集 /)
  })

  it('throws when data is not an object', () => {
    expect(() => normalizeSet(null)).toThrow('最外層必須是單一 JSON object')
    expect(() => normalizeSet('string')).toThrow('最外層必須是單一 JSON object')
    expect(() => normalizeSet([])).toThrow('最外層必須是單一 JSON object')
  })

  it('throws when items is missing', () => {
    const { items: _, ...rest } = validSet
    expect(() => normalizeSet(rest)).toThrow('缺少 items 陣列')
  })

  it('throws when items is not an array', () => {
    expect(() => normalizeSet({ ...validSet, items: 'not-array' })).toThrow('缺少 items 陣列')
  })

  it('throws when items is empty', () => {
    expect(() => normalizeSet({ ...validSet, items: [] })).toThrow('items 不可為空')
  })

  it('normalizes each item in the array', () => {
    const result = normalizeSet(validSet)
    expect(result.items[0].word).toBe('apple')
  })
})

describe('normalizeExportPayload', () => {
  it('parses payload with sets array', () => {
    const data = {
      sets: [
        {
          setName: 'Set 1',
          items: [
            {
              word: 'apple',
              meaning: '蘋果',
              example: 'Example',
              question: { prompt: 'Q?', opts: ['a', 'b', 'c', 'd'], ans: 0 },
            },
          ],
        },
      ],
    }
    const result = normalizeExportPayload(data)
    expect(result).toHaveLength(1)
    expect(result[0].setName).toBe('Set 1')
  })

  it('parses payload with items array (wraps in single set)', () => {
    const data = {
      items: [
        {
          word: 'apple',
          meaning: '蘋果',
          example: 'Example',
          question: { prompt: 'Q?', opts: ['a', 'b', 'c', 'd'], ans: 0 },
        },
      ],
    }
    const result = normalizeExportPayload(data)
    expect(result).toHaveLength(1)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].word).toBe('apple')
  })

  it('throws when data is not an object', () => {
    expect(() => normalizeExportPayload(null)).toThrow('匯入資料必須是 JSON object')
    expect(() => normalizeExportPayload([])).toThrow('匯入資料必須是 JSON object')
  })

  it('throws when sets is empty', () => {
    expect(() => normalizeExportPayload({ sets: [] })).toThrow('sets 不可為空')
  })

  it('throws when neither sets nor items is present', () => {
    expect(() => normalizeExportPayload({})).toThrow('找不到 sets 或 items')
    expect(() => normalizeExportPayload({ unknown: 'data' })).toThrow('找不到 sets 或 items')
  })
})

describe('normalizeSession', () => {
  const validSetIds = new Set(['set-1', 'set-2'])
  const validSession = {
    sourceSetId: 'set-1',
    mode: 'quiz',
    entries: [{ item: { id: 'i1' }, originalIndex: 0 }],
    index: 0,
    correctCount: 0,
    wrongEntries: [],
    answers: [],
    drafts: [],
    review: false,
    status: 'in-progress',
  }

  it('returns a normalized session for valid input', () => {
    const result = normalizeSession(validSession, validSetIds)
    expect(result).not.toBeNull()
    expect(result!.sourceSetId).toBe('set-1')
    expect(result!.mode).toBe('quiz')
  })

  it('returns null for non-object input', () => {
    expect(normalizeSession(null, validSetIds)).toBeNull()
    expect(normalizeSession('string', validSetIds)).toBeNull()
    expect(normalizeSession(123, validSetIds)).toBeNull()
    expect(normalizeSession([], validSetIds)).toBeNull()
    expect(normalizeSession(undefined, validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is missing', () => {
    const { sourceSetId: _, ...rest } = validSession
    expect(normalizeSession(rest, validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is empty', () => {
    expect(normalizeSession({ ...validSession, sourceSetId: '' }, validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is not in validSetIds', () => {
    expect(normalizeSession({ ...validSession, sourceSetId: 'unknown' }, validSetIds)).toBeNull()
  })

  it('returns null when mode is missing', () => {
    const { mode: _, ...rest } = validSession
    expect(normalizeSession(rest, validSetIds)).toBeNull()
  })

  it('returns null when mode is not a valid PracticeMode', () => {
    expect(normalizeSession({ ...validSession, mode: 'invalid' }, validSetIds)).toBeNull()
  })

  it('returns null when entries is missing or empty', () => {
    const { entries: _, ...rest } = validSession
    expect(normalizeSession(rest, validSetIds)).toBeNull()
    expect(normalizeSession({ ...validSession, entries: [] }, validSetIds)).toBeNull()
  })

  it('defaults missing index to 0', () => {
    const { index: _, ...rest } = validSession
    const result = normalizeSession(rest, validSetIds)
    expect(result!.index).toBe(0)
  })

  it('defaults negative index to 0', () => {
    const result = normalizeSession({ ...validSession, index: -1 }, validSetIds)
    expect(result!.index).toBe(0)
  })

  it('defaults missing correctCount to 0', () => {
    const { correctCount: _, ...rest } = validSession
    const result = normalizeSession(rest, validSetIds)
    expect(result!.correctCount).toBe(0)
  })

  it('defaults wrongEntries to [] when not an array', () => {
    const result = normalizeSession({ ...validSession, wrongEntries: 'invalid' }, validSetIds)
    expect(result!.wrongEntries).toEqual([])
  })

  it('defaults answers to [] when not an array', () => {
    const result = normalizeSession({ ...validSession, answers: 'invalid' }, validSetIds)
    expect(result!.answers).toEqual([])
  })

  it('defaults drafts to [] when not an array', () => {
    const result = normalizeSession({ ...validSession, drafts: 'invalid' }, validSetIds)
    expect(result!.drafts).toEqual([])
  })

  it('sets review based on truthiness', () => {
    const result = normalizeSession({ ...validSession, review: 1 as any }, validSetIds)
    expect(result!.review).toBe(true)
    const result2 = normalizeSession({ ...validSession, review: 0 as any }, validSetIds)
    expect(result2!.review).toBe(false)
  })

  it('sets status to completed when s.status is completed', () => {
    const result = normalizeSession({ ...validSession, status: 'completed' }, validSetIds)
    expect(result!.status).toBe('completed')
  })

  it('sets status to completed when view is "result"', () => {
    const result = normalizeSession(validSession, validSetIds, 'result')
    expect(result!.status).toBe('completed')
  })

  it('defaults status to "in-progress" when not completed and view is not result', () => {
    const result = normalizeSession(validSession, validSetIds)
    expect(result!.status).toBe('in-progress')
  })

  it('passes through supported practice modes', () => {
    const quizResult = normalizeSession({ ...validSession, mode: 'quiz' }, validSetIds)
    expect(quizResult!.mode).toBe('quiz')
    const spellingResult = normalizeSession({ ...validSession, mode: 'spelling' }, validSetIds)
    expect(spellingResult!.mode).toBe('spelling')
  })
})

describe('createEditorItem', () => {
  it('returns a blank editor item when no item is provided', () => {
    const result = createEditorItem(undefined, 0)
    expect(result.word).toBe('')
    expect(result.pos).toBe('')
    expect(result.meaning).toBe('')
    expect(result.example).toBe('')
  })

  it('returns a blank editor item when item is null', () => {
    const result = createEditorItem(null, 0)
    expect(result.word).toBe('')
  })

  it('copies fields from a valid item', () => {
    const item = {
      id: 'test-id',
      word: 'apple',
      pos: 'n.',
      meaning: '蘋果',
      example: 'I eat an apple.',
    }
    const result = createEditorItem(item, 0)
    expect(result.word).toBe('apple')
    expect(result.pos).toBe('n.')
    expect(result.meaning).toBe('蘋果')
    expect(result.example).toBe('I eat an apple.')
  })

  it('generates a fallback id when item has no id', () => {
    const item = {
      id: '',
      word: 'apple',
      pos: 'n.',
      meaning: '蘋果',
      example: 'Ex',
    }
    const result = createEditorItem(item, 3)
    expect(result.id).toBeTruthy()
  })

  it('trims the provided id', () => {
    const item = {
      id: '  abc  ',
      word: 'apple',
      pos: '',
      meaning: '蘋果',
      example: 'Ex',
    }
    const result = createEditorItem(item, 0)
    expect(result.id).toBe('abc')
  })
})

describe('createBlankEditorItem', () => {
  it('creates a blank editor item with the given index', () => {
    const result = createBlankEditorItem(2)
    expect(result.word).toBe('')
    expect(result.meaning).toBe('')
    expect(result.example).toBe('')
    expect(result.id).toBeTruthy()
  })
})

describe('createEditorItems', () => {
  it('returns empty array when no items provided', () => {
    const result = createEditorItems()
    expect(result).toEqual([])
  })

  it('returns empty array when empty array provided', () => {
    const result = createEditorItems([])
    expect(result).toEqual([])
  })

  it('converts each VocabItem to an EditorItem', () => {
    const items = [
      {
        id: 'a',
        word: 'apple',
        pos: 'n.',
        meaning: '蘋果',
        example: 'Ex',
      },
    ]
    const result = createEditorItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('apple')
    expect(result[0].id).toBe('a')
  })
})

describe('toSessionEntries', () => {
  it('returns an empty array when given an empty array', () => {
    const result = toSessionEntries([])
    expect(result).toEqual([])
  })

  it('creates session entries with the correct originalIndex', () => {
    const items = [
      { id: 'a', word: 'apple', pos: '', meaning: '蘋果', example: 'Ex' },
      { id: 'b', word: 'banana', pos: '', meaning: '香蕉', example: 'Ex' },
      { id: 'c', word: 'cat', pos: '', meaning: '貓', example: 'Ex' },
    ]
    const entries = toSessionEntries(items)
    expect(entries).toHaveLength(3)
    expect(entries[0].originalIndex).toBe(0)
    expect(entries[0].item).toBe(items[0])
    expect(entries[1].originalIndex).toBe(1)
    expect(entries[1].item).toBe(items[1])
    expect(entries[2].originalIndex).toBe(2)
    expect(entries[2].item).toBe(items[2])
  })
})
