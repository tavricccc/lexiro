import type { LibraryQuestion, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { parseLibraryImport } from '@/lib/library-import'
import { buildQuestionGenerationPrompt, filterQuestionsForWords, generatedQuestionCoverageIssue, generationSenseKey, getGenerationWords, getQuestionSourceRefs, getSelectedGenerationWords, normalizeQuestionGenerationJson, splitGenerationBatches } from '@/lib/question-generation'
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
    const easyPrompt = buildQuestionGenerationPrompt([word('keep')], 'multipleChoice', 1)
    const hardPrompt = buildQuestionGenerationPrompt([word('keep')], 'multipleChoice', 3)

    expect(easyPrompt).toContain('目標難度是 1')
    expect(easyPrompt).toContain('短而直接')
    expect(hardPrompt).toContain('目標難度是 3')
    expect(hardPrompt).toContain('較長或更細緻')
    expect(easyPrompt).not.toContain('回覆不要輸出 difficulty')
    expect(easyPrompt).not.toContain('程式會依題型補上')
    expect(hardPrompt).not.toBe(easyPrompt)
  })

  it('gives fill-blank responses an explicit placeholder contract', () => {
    const prompt = buildQuestionGenerationPrompt([word('keep')], 'fillBlank')

    expect(prompt).toContain('恰好包含一個五個 ASCII 底線的空格：`_____`')
    expect(prompt).toContain('禁止使用 `***`、`___`、`[blank]`、`<blank>`')
    expect(prompt).toContain('輸出前請在心中自我驗證')
    expect(prompt).toContain('不要輸出驗證或推理過程')
    expect(prompt).toContain('"prompt":"Her outstanding _____')
  })

  it('rejects non-standard fill-blank placeholders in the final parser', () => {
    const normalized = normalizeQuestionGenerationJson(JSON.stringify({
      questions: [{ sourceRef: 'source-1-1', prompt: '*** the plan.', options: ['keep', 'leave', 'lose', 'drop'], answerIndex: 0 }],
    }), 'fillBlank', 2, [word('keep')])
    const parsed = parseLibraryImport(normalized, {
      questionSources: getQuestionSourceRefs([word('keep')]),
      allowedDifficulty: 2,
      expectedQuestionKind: 'multipleChoice',
      expectedQuestionStyle: 'fillBlank',
      requireEnglish: true,
    })

    expect(parsed).toMatchObject({ valid: false, error: '第 1 題填空題題幹必須且只能包含一個 _____' })
  })

  it('expands the compact response into the canonical parser contract', () => {
    const compact = JSON.stringify({
      questions: [{ sourceRef: 'source-1-1', prompt: 'Which word means keep?', options: ['keep', 'leave', 'lose', 'drop'], answerIndex: 0 }],
    })
    const normalized = normalizeQuestionGenerationJson(compact, 'multipleChoice', 3, [word('keep')])
    const parsed = parseLibraryImport(normalized, {
      questionSources: getQuestionSourceRefs([word('keep')]),
      allowedDifficulty: 3,
      expectedQuestionKind: 'multipleChoice',
      expectedQuestionStyle: 'standard',
      requireEnglish: true,
    })

    expect(parsed.valid).toBe(true)
    if (parsed.valid && parsed.data.kind === 'questions')
      expect(parsed.data.questions[0]).toMatchObject({ kind: 'multipleChoice', questionStyle: 'standard', difficulty: 3, wordKey: 'keep', senseId: 'keep-sense' })
  })

  it('rejects response fields that the program owns', () => {
    const compact = JSON.stringify({
      questions: [{ sourceRef: 'source-1-1', difficulty: 1, prompt: 'Which word means keep?', options: ['keep', 'leave', 'lose', 'drop'], answerIndex: 0 }],
    })
    expect(() => normalizeQuestionGenerationJson(compact, 'multipleChoice', 3, [word('keep')])).toThrow('不支援欄位')
  })

  it('requires complete one-question-per-sense coverage', () => {
    const source = word('keep')
    const normalized = normalizeQuestionGenerationJson(JSON.stringify({
      questions: [{ sourceRef: 'source-1-1', prompt: 'Which word means keep?', options: ['keep', 'leave', 'lose', 'drop'], answerIndex: 0 }],
    }), 'multipleChoice', 2, [source])
    const parsed = parseLibraryImport(normalized, {
      questionSources: getQuestionSourceRefs([source]),
      allowedDifficulty: 2,
      expectedQuestionKind: 'multipleChoice',
      expectedQuestionStyle: 'standard',
      requireEnglish: true,
    })

    expect(parsed.valid && parsed.data.kind === 'questions' ? generatedQuestionCoverageIssue(parsed.data.questions, [source], 'multipleChoice') : 'parse failed').toBeNull()
    expect(generatedQuestionCoverageIssue([], [source], 'multipleChoice')).toBe('每個輸入 sense 必須且只能生成一題')
  })

  it('injects reading wordKeys and metadata owned by the program', () => {
    const sources = [word('keep'), word('run')]
    const normalized = normalizeQuestionGenerationJson(JSON.stringify({
      questions: [{
        title: 'A short story',
        passage: 'Keep the plan simple while the team runs a careful test.',
        questions: [
          { sourceRef: 'source-1-1', prompt: 'What should the team keep?', options: ['The plan', 'The test', 'The room', 'The result'], answerIndex: 0 },
          { sourceRef: 'source-2-1', prompt: 'What does the team run?', options: ['A test', 'A store', 'A race', 'A river'], answerIndex: 0 },
          { sourceRef: 'source-1-1', prompt: 'Which idea is supported?', options: ['The plan is simple', 'The plan is hidden', 'The team is late', 'The test is canceled'], answerIndex: 0 },
        ],
      }],
    }), 'reading', 3, sources)
    const parsed = parseLibraryImport(normalized, {
      questionSources: getQuestionSourceRefs(sources),
      allowedDifficulty: 3,
      expectedQuestionKind: 'reading',
      requireEnglish: true,
    })

    expect(parsed.valid).toBe(true)
    if (parsed.valid && parsed.data.kind === 'questions') {
      expect(parsed.data.questions[0]).toMatchObject({ kind: 'reading', difficulty: 3, wordKeys: ['keep', 'run'] })
      expect(generatedQuestionCoverageIssue(parsed.data.questions, sources, 'reading')).toBeNull()
    }
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
