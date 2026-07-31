import { describe, expect, it } from 'vitest'
import { buildSenseId, mergeWord, normalizeWordKey } from '@/lib/library'
import { parseLibraryImport } from '@/lib/library-import'

describe('library model', () => {
  it('normalizes word keys without changing phrases', () => {
    expect(normalizeWordKey('  New   York  ')).toBe('new york')
  })

  it('merges duplicate senses and keeps distinct meanings', () => {
    const wordKey = 'abandon'
    const first = {
      wordKey,
      word: 'abandon',
      senses: [{ id: buildSenseId(wordKey, 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: ['A'] }],
      synonyms: [],
      antonyms: [],
      updatedAt: new Date().toISOString(),
    }
    const merged = mergeWord(first, {
      ...first,
      senses: [
        { id: buildSenseId(wordKey, 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: ['B'] },
        { id: buildSenseId(wordKey, 'n.', '遺棄'), pos: 'n.', meaningZh: '遺棄', examples: ['C'] },
      ],
    })
    expect(merged.senses).toHaveLength(2)
    expect(merged.senses[0].examples).toEqual(['A', 'B'])
  })
})

describe('parseLibraryImport', () => {
  it('accepts vocab bundles without questions', () => {
    const result = parseLibraryImport(JSON.stringify({ kind: 'vocab', words: [{ word: 'abandon', senses: [{ pos: 'v.', meaningZh: '放棄', examples: [] }] }] }))
    expect(result.valid).toBe(true)
    if (result.valid)
      expect(result.data.kind).toBe('vocab')
  })

  it('accepts separate question bundles', () => {
    const result = parseLibraryImport(JSON.stringify({ kind: 'questions', questions: [{ id: 'q1', kind: 'multipleChoice', wordKey: 'abandon', prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0 }] }))
    expect(result.valid).toBe(true)
    if (result.valid && result.data.kind === 'questions') {
      expect(result.data.kind).toBe('questions')
      expect(result.data.questions).toHaveLength(1)
    }
  })
})
