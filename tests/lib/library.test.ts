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

  it('assigns stable unique ids when generated questions omit ids', () => {
    const payload = {
      kind: 'questions',
      questions: [
        { id: '由你產生', kind: 'multipleChoice', wordKey: 'abandon', prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0 },
        { id: '由你產生', kind: 'multipleChoice', wordKey: 'abandon', prompt: 'They decided to _____ the old building.', options: ['abandon', 'repair', 'paint', 'sell'], answerIndex: 0 },
      ],
    }
    const first = parseLibraryImport(JSON.stringify(payload))
    const second = parseLibraryImport(JSON.stringify(payload))
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)
    if (first.valid && second.valid && first.data.kind === 'questions' && second.data.kind === 'questions') {
      expect(first.data.questions).toHaveLength(2)
      expect(new Set(first.data.questions.map(question => question.id)).size).toBe(2)
      expect(first.data.questions.map(question => question.id)).toEqual(second.data.questions.map(question => question.id))
    }
  })

  it('ignores supplied question ids and hashes the normalized content', () => {
    const question = { kind: 'multipleChoice', wordKey: 'abandon', prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0 }
    const first = parseLibraryImport(JSON.stringify({ kind: 'questions', questions: [{ ...question, id: 'ai-id-one' }] }))
    const second = parseLibraryImport(JSON.stringify({ kind: 'questions', questions: [{ ...question, id: 'ai-id-two' }] }))
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)
    if (first.valid && second.valid && first.data.kind === 'questions' && second.data.kind === 'questions')
      expect(first.data.questions[0].id).toBe(second.data.questions[0].id)
  })
})
