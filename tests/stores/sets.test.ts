import type { VocabSet } from '@/types'
import { describe, expect, it } from 'vitest'
import { applyImportedSets, parseImportJson } from '@/lib/import'
import { normalizeExportPayload, normalizeSet } from '@/lib/validation'

const validItem = {
  id: '',
  word: 'apple',
  pos: '',
  meaning: '蘋果',
  example: 'I eat an apple.',
  question: {
    prompt: '蘋果的英文是？',
    opts: ['apple', 'banana', 'cherry', 'date'],
    ans: 0,
  },
}

const validSetData = {
  id: 'set-1',
  setName: 'Fruits',
  difficulty: 2,
  items: [validItem],
}

describe('normalizeSet', () => {
  it('normalizes a valid set', () => {
    const result = normalizeSet(validSetData, 'fallback-1')
    expect(result.id).toBe('set-1')
    expect(result.setName).toBe('Fruits')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].word).toBe('apple')
    expect(result.items[0].meaning).toBe('蘋果')
  })

  it('trims strings', () => {
    const data = {
      id: '  set-1  ',
      setName: '  Fruits  ',
      items: [{ ...validItem, word: '  apple  ' }],
    }
    const result = normalizeSet(data, 'fallback-1')
    expect(result.id).toBe('set-1')
    expect(result.setName).toBe('Fruits')
    expect(result.items[0].word).toBe('apple')
  })

  it('uses fallback id when id is missing', () => {
    const { id: _, ...noId } = validSetData
    const result = normalizeSet(noId, 'fallback-1')
    expect(result.id).toBe('fallback-1')
  })

  it('uses fallback id when id is empty string', () => {
    const data = { ...validSetData, id: '  ' }
    const result = normalizeSet(data, 'fallback-42')
    expect(result.id).toBe('fallback-42')
  })

  it('generates fallback setName when setName is missing', () => {
    const { setName: _, ...noName } = validSetData
    const result = normalizeSet(noName, 'f-1')
    expect(result.setName).toBeTruthy()
  })

  it('throws for non-object input', () => {
    expect(() => normalizeSet(null, 'f-1')).toThrow('最外層必須是單一 JSON object')
    expect(() => normalizeSet('string', 'f-1')).toThrow()
    expect(() => normalizeSet(123, 'f-1')).toThrow()
    expect(() => normalizeSet([], 'f-1')).toThrow()
  })

  it('throws when items is missing', () => {
    expect(() => normalizeSet({ setName: 'X' }, 'f-1')).toThrow('缺少 items 陣列')
  })

  it('throws when items is empty', () => {
    expect(() => normalizeSet({ setName: 'X', items: [] }, 'f-1')).toThrow('items 不可為空')
  })

  it('throws when an item is missing word', () => {
    const { word: _, ...noWord } = validItem
    expect(() => normalizeSet({ ...validSetData, items: [noWord] }, 'f-1')).toThrow('缺少 word')
  })

  it('throws when an item is missing meaning', () => {
    const { meaning: _, ...noMeaning } = validItem
    expect(() => normalizeSet({ ...validSetData, items: [noMeaning] }, 'f-1')).toThrow('缺少 meaning')
  })

  it('assigns auto-generated item ids', () => {
    const result = normalizeSet(validSetData, 'f-1')
    expect(result.items[0].id).toBeTruthy()
  })

  it('preserves provided item id', () => {
    const data = {
      ...validSetData,
      items: [{ ...validItem, id: 'custom-id' }],
    }
    const result = normalizeSet(data, 'f-1')
    expect(result.items[0].id).toBe('custom-id')
  })
})

describe('normalizeExportPayload', () => {
  it('normalizes payload with sets array', () => {
    const payload = { sets: [validSetData] }
    const result = normalizeExportPayload(payload)
    expect(result).toHaveLength(1)
    expect(result[0].setName).toBe('Fruits')
  })

  it('normalizes payload with items array (single set)', () => {
    const payload = { setName: 'Imported', items: [validItem] }
    const result = normalizeExportPayload(payload)
    expect(result).toHaveLength(1)
    expect(result[0].setName).toBe('Imported')
  })

  it('throws for empty sets', () => {
    expect(() => normalizeExportPayload({ sets: [] })).toThrow('sets 不可為空')
  })

  it('throws when neither sets nor items present', () => {
    expect(() => normalizeExportPayload({ foo: 'bar' })).toThrow('找不到 sets 或 items')
  })

  it('throws for non-object input', () => {
    expect(() => normalizeExportPayload(null)).toThrow('匯入資料必須是 JSON object')
    expect(() => normalizeExportPayload('string')).toThrow()
  })
})

describe('parseImportJson', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify(validSetData)
    const result = parseImportJson(json)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.setName).toBe('Fruits')
    }
  })

  it('strips markdown code fences', () => {
    const json = `\`\`\`json\n${JSON.stringify(validSetData)}\n\`\`\``
    const result = parseImportJson(json)
    expect(result.valid).toBe(true)
  })

  it('strips code fences without language tag', () => {
    const json = `\`\`\`\n${JSON.stringify(validSetData)}\n\`\`\``
    const result = parseImportJson(json)
    expect(result.valid).toBe(true)
  })

  it('returns error for invalid JSON', () => {
    const result = parseImportJson('not json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe('JSON 格式錯誤')
    }
  })

  it('returns error for malformed set data', () => {
    const json = JSON.stringify({ setName: 'X', items: [] })
    const result = parseImportJson(json)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBeTruthy()
    }
  })
})

describe('applyImportedSets (overwrite mode)', () => {
  it('replaces all local sets with target sets', () => {
    const local: VocabSet[] = [
      { id: '1', setName: 'Old', difficulty: 2, items: [validItem] },
    ]
    const target: VocabSet[] = [
      { id: '2', setName: 'New', difficulty: 2, items: [validItem] },
    ]
    const result = applyImportedSets(local, target, 'overwrite', {})
    expect(result.imported).toHaveLength(1)
    expect(result.imported[0].setName).toBe('New')
  })

  it('assigns unique ids to prevent collisions in overwrite mode', () => {
    const target: VocabSet[] = [
      { id: 'dup', setName: 'A', difficulty: 2, items: [validItem] },
      { id: 'dup', setName: 'B', difficulty: 2, items: [validItem] },
    ]
    const result = applyImportedSets([], target, 'overwrite', {})
    expect(result.imported[0].id).toBe('dup')
    expect(result.imported[1].id).toBe('dup-1')
  })
})

describe('applyImportedSets (append mode)', () => {
  const localItem = { ...validItem, word: 'existing-word' }
  const localSet: VocabSet = { id: 'local-1', setName: 'Existing', difficulty: 2, items: [localItem] }
  const newItem = { ...validItem, word: 'new-word' }
  const newSet: VocabSet = { id: 'import-1', setName: 'New Set', difficulty: 2, items: [newItem] }

  it('adds new sets that do not exist locally', () => {
    const result = applyImportedSets([localSet], [newSet], 'append', {})
    expect(result.imported).toHaveLength(1)
    expect(result.imported[0].setName).toBe('New Set')
    expect(result.renamedIds).toHaveLength(0)
  })

  it('skips duplicate sets by name when choice is local', () => {
    const duplicate = { id: 'import-2', setName: 'Existing', difficulty: 2, items: [newItem] }
    const result = applyImportedSets([localSet], [duplicate], 'append', {})
    expect(result.imported).toHaveLength(0)
    expect(result.skippedByName).toContain('Existing')
  })

  it('replaces local set by name when choice is imported', () => {
    const duplicate = { id: 'import-2', setName: 'Existing', difficulty: 2, items: [newItem] }
    const result = applyImportedSets([localSet], [duplicate], 'append', { Existing: 'imported' })
    expect(result.replacedVersions).toContain('Existing')
    expect(result.imported).toHaveLength(0)
  })

  it('skips duplicate sets by identical content with different name', () => {
    const sameContent = { id: 'import-2', setName: 'Different Name', difficulty: 2, items: [localItem] }
    const result = applyImportedSets([localSet], [sameContent], 'append', {})
    expect(result.skippedByContent).toContain('Different Name')
    expect(result.imported).toHaveLength(0)
  })

  it('renames sets when id collides with existing', () => {
    const colliding = { id: 'local-1', setName: 'Colliding', difficulty: 2, items: [newItem] }
    const result = applyImportedSets([localSet], [colliding], 'append', {})
    expect(result.renamedIds).toHaveLength(1)
    expect(result.renamedIds[0].from).toBe('local-1')
    expect(result.renamedIds[0].to).toBe('local-1-1')
    expect(result.imported[0].id).toBe('local-1-1')
  })
})

describe('full workflow: parse → normalize → apply', () => {
  it('parses JSON, normalizes, and appends to empty local sets', () => {
    const json = JSON.stringify(validSetData)
    const parsed = parseImportJson(json)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid)
      return

    const result = applyImportedSets([], [parsed.data], 'append', {})
    expect(result.imported).toHaveLength(1)
    expect(result.imported[0].setName).toBe('Fruits')
    expect(result.imported[0].items[0].word).toBe('apple')
  })

  it('parses JSON, normalizes, and overwrites local sets', () => {
    const local: VocabSet[] = [
      { id: '1', setName: 'Old', difficulty: 2, items: [validItem] },
    ]
    const json = JSON.stringify({ id: '2', setName: 'New', items: [validItem] })
    const parsed = parseImportJson(json)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid)
      return

    const result = applyImportedSets(local, [parsed.data], 'overwrite', {})
    expect(result.imported).toHaveLength(1)
    expect(result.imported[0].setName).toBe('New')
  })

  it('handles full export payload with sets array', () => {
    const payload = { sets: [validSetData] }
    const normalized = normalizeExportPayload(payload)
    expect(normalized).toHaveLength(1)

    const result = applyImportedSets([], normalized, 'append', {})
    expect(result.imported).toHaveLength(1)
  })
})
