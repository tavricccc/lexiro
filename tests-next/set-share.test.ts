import type { LibraryQuestion, LibraryState, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'

import { createUncategorizedFolder, UNCATEGORIZED_FOLDER_ID } from '@/src/lib/folders'
import { buildSenseId, canonicalizeQuestion } from '@/src/lib/library'
import { createSetSharePayload, parseSetShareValue } from '@/src/lib/set-share'

const timestamp = '2026-08-17T00:00:00.000Z'
const wordKey = 'adapt'
const includedSenseId = buildSenseId(wordKey, 'v.', '適應')
const otherSenseId = buildSenseId(wordKey, 'v.', '改編')

function question(id: string, senseId: string, clue: string): LibraryQuestion {
  return canonicalizeQuestion({
    id,
    fingerprint: 'pending',
    kind: 'multipleChoice',
    questionStyle: 'standard',
    difficulty: 1,
    wordKey,
    senseId,
    prompt: `Which option means ${clue}?`,
    options: ['adapt', 'avoid', 'delay', 'remove'],
    answerIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

function library(): LibraryState {
  const word: WordEntry = {
    wordKey,
    word: 'adapt',
    senses: [
      { id: includedSenseId, pos: 'v.', meaningZh: '適應', examples: ['We adapt quickly.'] },
      { id: otherSenseId, pos: 'v.', meaningZh: '改編', examples: ['They adapted the novel.'] },
    ],
    updatedAt: timestamp,
  }
  return {
    version: 1,
    words: { [wordKey]: word },
    sets: [{ id: 'set-1', setName: '核心單字', folderId: UNCATEGORIZED_FOLDER_ID, createdAt: timestamp, updatedAt: timestamp }],
    memberships: { 'set-1': [{ wordKey, senseIds: [includedSenseId] }] },
    folders: [createUncategorizedFolder()],
    questions: [question('included', includedSenseId, 'to adjust to change'), question('excluded', otherSenseId, 'to turn a novel into a film')],
    updatedAt: timestamp,
  }
}

describe('set sharing', () => {
  it('exports only the senses and questions owned by the selected set', () => {
    const payload = createSetSharePayload(library(), 'set-1')
    expect(payload.sets[0].words[0].senses.map(sense => sense.id)).toEqual([includedSenseId])
    expect(payload.sets[0].questions.map(item => item.id)).toEqual(['included'])
  })

  it('accepts the canonical share shape', () => {
    const payload = createSetSharePayload(library(), 'set-1')
    const parsed = parseSetShareValue(payload)
    expect(parsed.kind).toBe('set-share')
    expect(parsed.sets).toHaveLength(1)
  })

  it('rejects a share whose membership points to an unknown sense', () => {
    const payload = createSetSharePayload(library(), 'set-1')
    payload.sets[0].memberships[0].senseIds = ['missing']
    expect(() => parseSetShareValue(payload)).toThrow(/senseId/u)
  })
})
