import type { ImportMode, ImportResult, VersionDiff, VocabSet } from '@/types'
import { normalizeSet } from './validation'

function getSetContentSignature(set: VocabSet): string {
  return JSON.stringify(
    set.items.map(item => ({
      word: item.word,
      pos: item.pos,
      meaning: item.meaning,
      example: item.example,
    })),
  )
}

function getItemContentSignature(item: VocabSet['items'][number]): string {
  return JSON.stringify({
    word: item.word,
    pos: item.pos,
    meaning: item.meaning,
    example: item.example,
  })
}

function getItemKey(item: VocabSet['items'][number]): string {
  return item.word.trim().toLowerCase()
}

export function createImportVersionDiff(localSet: VocabSet, importedSet: VocabSet): VersionDiff {
  const localItems = new Map(localSet.items.map(item => [getItemKey(item), item]))
  const importedItems = new Map(importedSet.items.map(item => [getItemKey(item), item]))
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  importedItems.forEach((importedItem, key) => {
    const localItem = localItems.get(key)
    if (!localItem) {
      added.push(importedItem.word)
      return
    }
    if (getItemContentSignature(localItem) !== getItemContentSignature(importedItem)) {
      changed.push(importedItem.word)
    }
  })

  localItems.forEach((localItem, key) => {
    if (!importedItems.has(key)) {
      removed.push(localItem.word)
    }
  })

  return {
    setName: importedSet.setName,
    localSetId: localSet.id,
    localCount: localSet.items.length,
    importedCount: importedSet.items.length,
    added,
    removed,
    changed,
    identical: !added.length && !removed.length && !changed.length,
  }
}

export function ensureUniqueSetId(baseId: string, existingIds: Set<string>): string {
  let nextId = baseId
  let counter = 1
  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${counter}`
    counter++
  }
  return nextId
}

export function refreshImportVersionDiffs(
  localSets: VocabSet[],
  targetSets: VocabSet[],
  currentChoices: Record<string, string>,
): { diffs: VersionDiff[], choices: Record<string, string> } {
  const localByName = new Map(localSets.map(set => [set.setName.trim(), set]))
  const diffs = targetSets
    .map((set) => {
      const localSet = localByName.get(set.setName.trim())
      return localSet ? createImportVersionDiff(localSet, set) : null
    })
    .filter((diff): diff is VersionDiff => diff !== null)

  const choices = diffs.reduce<Record<string, string>>((acc, diff) => {
    acc[diff.setName] = currentChoices[diff.setName] ?? 'local'
    return acc
  }, {})

  return { diffs, choices }
}

export function summarizeDuplicateResult(result: ImportResult): string {
  const messages: string[] = []
  if (result.skippedByName.length) {
    messages.push(`保留本機版本 ${result.skippedByName.length} 個：${result.skippedByName.join('、')}`)
  }
  if (result.replacedVersions.length) {
    messages.push(`使用匯入版本更新 ${result.replacedVersions.length} 個：${result.replacedVersions.join('、')}`)
  }
  if (result.skippedByContent.length) {
    messages.push(`偵測到重複內容，略過 ${result.skippedByContent.length} 個：${result.skippedByContent.join('、')}`)
  }
  if (result.renamedIds.length) {
    messages.push(`因 id 衝突已改用新 id：${result.renamedIds.map(item => item.setName).join('、')}`)
  }
  return messages.join('；')
}

export function applyImportedSets(
  localSets: VocabSet[],
  targetSets: VocabSet[],
  mode: ImportMode,
  importVersionChoices: Record<string, string>,
): ImportResult {
  const existingIds = new Set(localSets.map(set => set.id))
  const result: ImportResult = {
    imported: [],
    skippedByName: [],
    skippedByContent: [],
    renamedIds: [],
    replacedVersions: [],
  }

  if (mode === 'overwrite') {
    const nextIds = new Set<string>()
    const imported = targetSets.map((set, index) => {
      const baseId = typeof set.id === 'string' && set.id.trim() ? set.id.trim() : `imported-${Date.now()}-${index + 1}`
      const id = ensureUniqueSetId(baseId, nextIds)
      nextIds.add(id)
      return { ...set, id }
    })
    result.imported = imported
    return result
  }

  const nextSets = [...localSets]
  const existingContentSignatures = new Set(localSets.map(set => getSetContentSignature(set)))
  const importedContentSignatures = new Set<string>()
  const replacedSetIds = new Set<string>()

  targetSets.forEach((set) => {
    const existingIndex = nextSets.findIndex(localSet => localSet.setName.trim() === set.setName.trim())
    if (existingIndex !== -1) {
      const localSet = nextSets[existingIndex]
      const choice = importVersionChoices[set.setName] ?? 'local'
      if (choice === 'imported') {
        existingContentSignatures.delete(getSetContentSignature(localSet))
        nextSets[existingIndex] = { ...set, id: localSet.id }
        existingContentSignatures.add(getSetContentSignature(nextSets[existingIndex]))
        replacedSetIds.add(localSet.id)
        result.replacedVersions.push(set.setName)
        return
      }
      result.skippedByName.push(set.setName)
      return
    }

    const signature = getSetContentSignature(set)
    if (existingContentSignatures.has(signature) || importedContentSignatures.has(signature)) {
      result.skippedByContent.push(set.setName)
      return
    }

    const baseId = typeof set.id === 'string' && set.id.trim() ? set.id.trim() : `imported-${Date.now()}-${targetSets.indexOf(set) + 1}`
    const id = ensureUniqueSetId(baseId, existingIds)
    existingIds.add(id)
    existingContentSignatures.add(signature)
    importedContentSignatures.add(signature)
    if (id !== baseId) {
      result.renamedIds.push({ setName: set.setName, from: baseId, to: id })
    }
    result.imported.push({ ...set, id })
  })

  return result
}

export function parseImportJson(text: string): { valid: true, data: VocabSet } | { valid: false, error: string } {
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\n?```\s*$/, '').trim()

  let data: unknown
  try {
    data = JSON.parse(json)
  }
  catch {
    return { valid: false, error: 'JSON 格式錯誤' }
  }

  try {
    return { valid: true, data: normalizeSet(data) }
  }
  catch (error) {
    return { valid: false, error: (error as Error).message }
  }
}
