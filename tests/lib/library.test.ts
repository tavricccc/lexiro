import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSenseId, mergeWord, normalizePartOfSpeech, normalizeWordKey } from '@/lib/library'
import { parseLibraryImport, parseLibraryImportValue } from '@/lib/library-import'

describe('library model', () => {
  it('normalizes word keys without changing phrases', () => {
    expect(normalizeWordKey('  New   York  ')).toBe('new york')
  })

  it('normalizes part of speech aliases to the canonical abbreviations', () => {
    expect(normalizePartOfSpeech(' NOUN ')).toBe('n.')
    expect(normalizePartOfSpeech('phrasal verb')).toBe('phr. v.')
    expect(normalizePartOfSpeech('unknown')).toBe('')
  })

  it('merges duplicate senses and keeps distinct meanings', () => {
    const wordKey = 'abandon'
    const first = {
      wordKey,
      word: 'abandon',
      senses: [{ id: buildSenseId(wordKey, 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: ['A'] }],
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
  it('uses the same canonical parser for decoded payloads', () => {
    const result = parseLibraryImportValue({
      schemaVersion: 1,
      kind: 'words',
      words: [{ wordKey: 'abandon', word: 'abandon', senses: [{ id: buildSenseId('abandon', 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(result).toMatchObject({ valid: true, data: { kind: 'words' } })
  })

  it('accepts word bundles without questions', () => {
    const result = parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'words',
      words: [{ wordKey: 'abandon', word: 'abandon', senses: [{ id: buildSenseId('abandon', 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))
    expect(result.valid).toBe(true)
    if (result.valid)
      expect(result.data.kind).toBe('words')
  })

  it('accepts separate question bundles', () => {
    const result = parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: [{ id: 'q1', kind: 'multipleChoice', questionStyle: 'fillBlank', wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄'), difficulty: 1, prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))
    expect(result.valid).toBe(true)
    if (result.valid && result.data.kind === 'questions') {
      expect(result.data.kind).toBe('questions')
      expect(result.data.questions).toHaveLength(1)
    }
  })

  it('accepts the generated canonical output bundles', () => {
    const words = parseLibraryImport(readFileSync(new URL('../../output/vocab/vocab-001.json', import.meta.url), 'utf8'))
    const questionText = readFileSync(new URL('../../output/questions/standard-001.json', import.meta.url), 'utf8')
    const questionPayload = JSON.parse(questionText) as { questions: Array<{ fingerprint: string }> }
    const questions = parseLibraryImport(questionText)

    expect(words.valid).toBe(true)
    expect(questions.valid).toBe(true)
    if (questions.valid && questions.data.kind === 'questions')
      expect(questions.data.questions[0].fingerprint).toBe(questionPayload.questions[0].fingerprint)
  })

  it('accepts every generated canonical output bundle', () => {
    for (const directory of ['../../output/vocab', '../../output/questions']) {
      const files = readdirSync(new URL(`${directory}/`, import.meta.url)).filter(file => file.endsWith('.json'))
      expect(files.length).toBeGreaterThan(0)
      for (const file of files)
        expect(parseLibraryImport(readFileSync(new URL(`${directory}/${file}`, import.meta.url), 'utf8'))).toMatchObject({ valid: true })
    }
  })

  it('keeps the generated output manifest aligned with its files', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../output/manifest.json', import.meta.url), 'utf8')) as {
      files: { vocab: string[], questions: string[] }
      stats: { uniqueWords: number, supportedQuestions: { standard: number, fillBlank: number, reading: number } }
      inputDir?: string
    }
    expect(manifest.inputDir).toBeUndefined()
    const vocabFiles = readdirSync(new URL('../../output/vocab/', import.meta.url)).filter(file => file.endsWith('.json')).sort()
    const questionFiles = readdirSync(new URL('../../output/questions/', import.meta.url)).filter(file => file.endsWith('.json')).sort()
    expect([...manifest.files.vocab].sort()).toEqual(vocabFiles)
    expect([...manifest.files.questions].sort()).toEqual(questionFiles)

    const wordCount = vocabFiles.reduce((total, file) => {
      const payload = JSON.parse(readFileSync(new URL(`../../output/vocab/${file}`, import.meta.url), 'utf8')) as { words: unknown[] }
      return total + payload.words.length
    }, 0)
    const questionCounts = questionFiles.reduce((counts, file) => {
      const payload = JSON.parse(readFileSync(new URL(`../../output/questions/${file}`, import.meta.url), 'utf8')) as { questions: Array<{ kind: string, questionStyle?: string }> }
      for (const question of payload.questions) {
        const key = question.kind === 'reading' ? 'reading' : question.questionStyle as 'standard' | 'fillBlank'
        counts[key] += 1
      }
      return counts
    }, { standard: 0, fillBlank: 0, reading: 0 })
    expect(manifest.stats.uniqueWords).toBe(wordCount)
    expect(manifest.stats.supportedQuestions).toEqual(questionCounts)
  })

  it('requires the canonical examples field', () => {
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'words',
      words: [{
        wordKey: 'abandon',
        word: 'abandon',
        senses: [{ id: buildSenseId('abandon', 'v.', '放棄'), pos: 'v.', meaningZh: '放棄' }],
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }))).toMatchObject({ valid: false })
  })

  it('rejects duplicate reading word keys and child ids', () => {
    const child = { id: 'child-1', kind: 'multipleChoice', prompt: 'What happened?', options: ['A', 'B', 'C', 'D'], answerIndex: 0, wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄') }
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: [{ id: 'reading-1', kind: 'reading', title: 'Reading', passage: 'A passage.', wordKeys: ['abandon', 'abandon'], questions: [child], difficulty: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))).toMatchObject({ valid: false })
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: [{ id: 'reading-1', kind: 'reading', title: 'Reading', passage: 'A passage.', wordKeys: ['abandon'], questions: [child, { ...child, prompt: 'What changed?' }], difficulty: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))).toMatchObject({ valid: false })
  })

  it('rejects canonical bundles without an envelope or formal identity', () => {
    const payload = {
      kind: 'questions',
      questions: [
        { kind: 'multipleChoice', questionStyle: 'fillBlank', wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄'), difficulty: 1, prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0 },
      ],
    }
    expect(parseLibraryImport(JSON.stringify(payload))).toMatchObject({ valid: false })
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: payload.questions,
    }))).toMatchObject({ valid: false })
  })

  it('preserves formal ids while computing a content fingerprint', () => {
    const question = { kind: 'multipleChoice', questionStyle: 'fillBlank', wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄'), difficulty: 1, prompt: '_____ the plan.', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
    const first = parseLibraryImport(JSON.stringify({ schemaVersion: 1, kind: 'questions', questions: [{ ...question, id: 'ai-id-one' }] }))
    const second = parseLibraryImport(JSON.stringify({ schemaVersion: 1, kind: 'questions', questions: [{ ...question, id: 'ai-id-two' }] }))
    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)
    if (first.valid && second.valid && first.data.kind === 'questions' && second.data.kind === 'questions') {
      expect(first.data.questions[0].id).toBe('ai-id-one')
      expect(second.data.questions[0].id).toBe('ai-id-two')
      expect(first.data.questions[0].fingerprint).toBe(second.data.questions[0].fingerprint)
    }
  })

  it('resolves AI sourceRefs and rejects unknown references', () => {
    const senseId = buildSenseId('abandon', 'v.', '放棄')
    const payload = JSON.stringify({
      kind: 'questions',
      questions: [{ kind: 'multipleChoice', sourceRef: 'source-1-1', questionStyle: 'standard', difficulty: 1, prompt: 'Choose.', options: ['a', 'b', 'c', 'd'], answerIndex: 0 }],
    })
    const parsed = parseLibraryImport(payload, { questionSources: { 'source-1-1': { wordKey: 'abandon', senseId } } })
    expect(parsed.valid).toBe(true)
    if (parsed.valid && parsed.data.kind === 'questions')
      expect(parsed.data.questions[0]).toMatchObject({ wordKey: 'abandon', senseId })

    expect(parseLibraryImport(payload, { questionSources: { 'source-2-1': { wordKey: 'abandon', senseId } } })).toMatchObject({ valid: false })
  })

  it('rejects generated questions outside the selected difficulty', () => {
    const payload = JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: [{ id: 'q1', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄'), difficulty: 2, prompt: 'Choose.', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(parseLibraryImport(payload, { allowedDifficulty: 1 })).toMatchObject({ valid: false })
    expect(parseLibraryImport(payload, { allowedDifficulty: 2 })).toMatchObject({ valid: true })
  })

  it('rejects unknown fields instead of silently dropping them', () => {
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'words',
      words: [{ wordKey: 'abandon', word: 'abandon', unexpectedField: 'leave behind', senses: [{ id: buildSenseId('abandon', 'v.', '放棄'), pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))).toMatchObject({ valid: false })
    expect(parseLibraryImport(JSON.stringify({
      schemaVersion: 1,
      kind: 'questions',
      questions: [{ id: 'q1', kind: 'multipleChoice', unexpectedField: 'quiz', questionStyle: 'standard', wordKey: 'abandon', senseId: buildSenseId('abandon', 'v.', '放棄'), difficulty: 1, prompt: 'Choose.', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    }))).toMatchObject({ valid: false })
  })

  it('requires sourceRef-only identities for AI question responses', () => {
    const senseId = buildSenseId('abandon', 'v.', '放棄')
    const payload = JSON.stringify({
      kind: 'questions',
      questions: [{ kind: 'multipleChoice', sourceRef: 'source-1-1', id: 'ai-generated-id', questionStyle: 'standard', difficulty: 1, prompt: 'Choose.', options: ['a', 'b', 'c', 'd'], answerIndex: 0 }],
    })
    expect(parseLibraryImport(payload, { questionSources: { 'source-1-1': { wordKey: 'abandon', senseId } } })).toMatchObject({ valid: false })
  })
})
