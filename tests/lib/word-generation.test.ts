import { describe, expect, it } from 'vitest'
import { buildWordGenerationSources, parseWordGenerationJson } from '@/lib/word-generation'

describe('ai word generation contract', () => {
  it('keeps source references for duplicate words while extracting English entries', () => {
    expect(buildWordGenerationSources('run 跑步\nrun 經營\ntake off')).toEqual([
      { sourceRef: 'source-1', word: 'run', raw: 'run 跑步' },
      { sourceRef: 'source-2', word: 'run', raw: 'run 經營' },
      { sourceRef: 'source-3', word: 'take off', raw: 'take off' },
    ])
  })

  it('merges duplicate source words without losing distinct senses', () => {
    const sources = buildWordGenerationSources('run 跑步\nrun 經營')
    const drafts = parseWordGenerationJson(JSON.stringify({
      kind: 'words',
      words: [
        { sourceRef: 'source-2', word: 'run', senses: [{ pos: 'v.', meaningZh: '經營', examples: [] }] },
        { sourceRef: 'source-1', word: 'run', senses: [{ pos: 'v.', meaningZh: '跑步', examples: [] }] },
      ],
    }), sources, false)

    expect(drafts).toHaveLength(1)
    expect(drafts[0].senses.map(sense => sense.meaning)).toEqual(['經營', '跑步'])
  })

  it('requires known source references and rejects generated identity fields', () => {
    const sources = buildWordGenerationSources('adapt')
    const base = { sourceRef: 'source-1', word: 'adapt', senses: [{ pos: 'v.', meaningZh: '適應', examples: [] }] }
    expect(() => parseWordGenerationJson(JSON.stringify({ kind: 'words', words: [{ ...base, sourceRef: 'unknown' }] }), sources, false)).toThrow('未知 sourceRef')
    expect(() => parseWordGenerationJson(JSON.stringify({ kind: 'words', words: [{ ...base, id: 'old-id' }] }), sources, false)).toThrow('不支援欄位')
  })

  it('requires exactly one English example only when requested', () => {
    const sources = buildWordGenerationSources('adapt')
    const response = JSON.stringify({ kind: 'words', words: [{ sourceRef: 'source-1', word: 'adapt', senses: [{ pos: 'v.', meaningZh: '適應', examples: ['We adapt quickly.'] }] }] })
    expect(() => parseWordGenerationJson(response, sources, false)).toThrow('不應包含例句')
    expect(parseWordGenerationJson(response, sources, true)[0].senses[0].examples).toEqual(['We adapt quickly.'])
  })
})
