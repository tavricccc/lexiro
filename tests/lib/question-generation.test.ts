import type { LibraryQuestion, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildQuestionGenerationPrompt, filterQuestionsForWords, generationSenseKey, getGenerationWords, getQuestionSourceRefs, getSelectedGenerationWords, splitGenerationBatches } from '@/lib/question-generation'
import { createSourceRef } from '@/lib/source-ref'

function word(wordKey: string): WordEntry {
  return {
    wordKey,
    word: wordKey,
    senses: [{ id: `${wordKey}-sense`, pos: 'v.', meaningZh: '意思', examples: [] }],
    updatedAt: '',
  }
}

describe('question generation selection rules', () => {
  it('limits reading prompts to one batch of fifteen words', () => {
    const words = Array.from({ length: 20 }, (_, index) => word(`word-${index}`))

    expect(getGenerationWords(words, 'reading')).toHaveLength(15)
    expect(splitGenerationBatches(words, 'reading')).toHaveLength(1)
    expect(splitGenerationBatches(words, 'reading')[0]).toEqual(words.slice(0, 15))
  })

  it('splits non-reading prompts into batches without dropping words', () => {
    const words = Array.from({ length: 31 }, (_, index) => word(`word-${index}`))
    const batches = splitGenerationBatches(words, 'fillBlank')

    expect(batches.map(batch => batch.length)).toEqual([15, 15, 1])
    expect(batches.flat()).toEqual(words)
  })

  it('keeps only questions that reference the selected words', () => {
    const questions: LibraryQuestion[] = [
      { id: 'choice', fingerprint: 'fp-choice', kind: 'multipleChoice', wordKey: 'keep', senseId: 'keep-sense', questionStyle: 'standard', prompt: 'Prompt', options: ['a', 'b', 'c', 'd'], answerIndex: 0, difficulty: 1, createdAt: '', updatedAt: '' },
      { id: 'drop', fingerprint: 'fp-drop', kind: 'multipleChoice', questionStyle: 'fillBlank', wordKey: 'drop', senseId: 'drop-sense', prompt: '_____ Prompt', options: ['keep', 'drop', 'stay', 'leave'], answerIndex: 0, difficulty: 2, createdAt: '', updatedAt: '' },
      { id: 'reading', fingerprint: 'fp-reading', kind: 'reading', title: 'Reading', passage: 'Passage', wordKeys: ['keep'], questions: [{ id: 'child', kind: 'multipleChoice', prompt: 'Prompt', options: ['a', 'b', 'c', 'd'], answerIndex: 0, wordKey: 'keep', senseId: 'keep-sense' }], difficulty: 3, createdAt: '', updatedAt: '' },
    ]

    expect(filterQuestionsForWords(questions, [word('keep')]).map(question => question.id)).toEqual(['choice', 'reading'])
  })

  it('includes the selected difficulty in the prompt', () => {
    expect(buildQuestionGenerationPrompt([word('keep')], 'multipleChoice', 1)).toContain('每一題的 difficulty 必須是 1')
    expect(buildQuestionGenerationPrompt([word('keep')], 'multipleChoice', 1)).toContain('"difficulty":1')
  })

  it('selects senses while keeping the vocabulary grouped by word', () => {
    const source: WordEntry = {
      ...word('run'),
      senses: [
        { id: 'run-noun', pos: 'n.', meaningZh: '跑步', examples: [] },
        { id: 'run-verb', pos: 'v.', meaningZh: '經營', examples: [] },
      ],
    }
    const selected = getSelectedGenerationWords([source], [generationSenseKey('run', 'run-verb')])

    expect(selected).toHaveLength(1)
    expect(selected[0].senses.map(sense => sense.id)).toEqual(['run-verb'])
    expect(getQuestionSourceRefs(selected)).toMatchObject({
      'source-1': { wordKey: 'run', senseId: 'run-verb' },
      'source-1-1': { wordKey: 'run', senseId: 'run-verb' },
    })
  })

  it('uses the same source references in lookup maps and prompts', () => {
    const source = {
      ...word('run'),
      senses: [
        { id: 'run-noun', pos: 'n.', meaningZh: '跑步', examples: [] },
        { id: 'run-verb', pos: 'v.', meaningZh: '經營', examples: [] },
      ],
    }
    const refs = getQuestionSourceRefs([source])
    const prompt = buildQuestionGenerationPrompt([source], 'multipleChoice')

    expect(refs[createSourceRef(0)]).toEqual({ wordKey: 'run', senseId: 'run-noun' })
    expect(refs[createSourceRef(0, 1)]).toEqual({ wordKey: 'run', senseId: 'run-verb' })
    expect(prompt).toContain('"sourceRef": "source-1"')
    expect(prompt).toContain('"sourceRef": "source-1-2"')
  })

  it('batches by selected sense count rather than word count', () => {
    const words = Array.from({ length: 8 }, (_, index) => ({
      ...word(`word-${index}`),
      senses: [
        { id: `word-${index}-a`, pos: 'v.', meaningZh: '意思一', examples: [] },
        { id: `word-${index}-b`, pos: 'n.', meaningZh: '意思二', examples: [] },
      ],
    }))
    const batches = splitGenerationBatches(words, 'multipleChoice')

    expect(batches.map(batch => batch.reduce((count, item) => count + item.senses.length, 0))).toEqual([14, 2])
  })
})
