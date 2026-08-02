import type { LibraryQuestion, PracticeDifficulty, ReadingPack, SessionEntry, StudyWord } from '@/types'
import { normalizeWordKey } from './library'
import { toReadingPracticeQuestion } from './practice-question'
import { shuffleEntries } from './shuffle'

export function readingGroupForPack(pack: ReadingPack, items: StudyWord[], difficulty: PracticeDifficulty): SessionEntry[] | null {
  if (difficulty !== 'all' && pack.difficulty !== difficulty)
    return null

  const itemsBySenseId = new Map(items.map(item => [item.id, item]))
  const itemIndexes = new Map(items.map((item, index) => [item.id, index]))
  const packWordKeys = new Set(pack.wordKeys.map(normalizeWordKey))
  if (!packWordKeys.size || packWordKeys.size !== pack.wordKeys.length || Array.from(packWordKeys).some(wordKey => !items.some(item => item.wordKey === wordKey)))
    return null

  const entries = pack.questions.map((child) => {
    if (child.kind !== 'multipleChoice' || child.options.length !== 4 || !Number.isInteger(child.answerIndex) || child.answerIndex < 0 || child.answerIndex >= child.options.length)
      return null
    const item = itemsBySenseId.get(child.senseId)
    const originalIndex = item ? itemIndexes.get(item.id) : undefined
    if (!item || originalIndex === undefined || item.wordKey !== normalizeWordKey(child.wordKey) || !packWordKeys.has(item.wordKey))
      return null
    return {
      item,
      question: toReadingPracticeQuestion(pack, child),
      originalIndex,
      readingPassage: pack.passage,
      readingPackId: pack.id,
    }
  })
  const validEntries = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  return validEntries.length > 0 && validEntries.length === pack.questions.length ? validEntries : null
}

export function readingGroupsForItems(questions: LibraryQuestion[], items: StudyWord[], difficulty: PracticeDifficulty = 'all'): SessionEntry[][] {
  return questions
    .filter((question): question is ReadingPack => question.kind === 'reading')
    .map(pack => readingGroupForPack(pack, items, difficulty))
    .filter((group): group is SessionEntry[] => Boolean(group))
}

export function groupReadingEntries(entries: SessionEntry[]): SessionEntry[][] {
  const groups = new Map<string, SessionEntry[]>()
  for (const entry of entries) {
    const key = entry.readingPackId ?? entry.question?.questionId
    if (!key)
      continue
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return Array.from(groups.values())
}

export function expandReadingReviewEntries(entries: SessionEntry[], groups: SessionEntry[][]): SessionEntry[] {
  const selectedPackIds = new Set(entries
    .filter(entry => entry.question?.questionType === 'reading')
    .map(entry => entry.readingPackId)
    .filter((packId): packId is string => Boolean(packId)))
  if (!selectedPackIds.size)
    return entries
  const nonReadingEntries = entries.filter(entry => entry.question?.questionType !== 'reading')
  const fullReadingPacks = groups
    .filter(group => group.some(entry => entry.readingPackId && selectedPackIds.has(entry.readingPackId)))
    .flat()
  return [...nonReadingEntries, ...fullReadingPacks]
}

export function takeQuestionEntries(candidates: SessionEntry[], target: number, usedQuestionIds: Set<string>, usedSenseIds: Set<string>, preferredSenseIds: Set<string> = new Set()): SessionEntry[] {
  const selected: SessionEntry[] = []
  const uniqueCandidates = new Map<string, SessionEntry>()
  for (const entry of candidates) {
    const questionId = entry.question?.questionId
    if (questionId)
      uniqueCandidates.set(questionId, entry)
  }
  const available = shuffleEntries(Array.from(uniqueCandidates.values())).sort((a, b) => Number(preferredSenseIds.has(b.item.id)) - Number(preferredSenseIds.has(a.item.id)))
  for (const entry of available) {
    if (selected.length >= target)
      break
    const questionKey = entry.question?.questionId
    if (!questionKey)
      continue
    if (usedQuestionIds.has(questionKey) || usedSenseIds.has(entry.item.id))
      continue
    usedQuestionIds.add(questionKey)
    usedSenseIds.add(entry.item.id)
    selected.push(entry)
  }
  if (selected.length < target) {
    for (const entry of available) {
      if (selected.length >= target)
        break
      const questionKey = entry.question?.questionId
      if (!questionKey || usedQuestionIds.has(questionKey))
        continue
      usedQuestionIds.add(questionKey)
      selected.push(entry)
    }
  }
  return selected
}

export function balancedQuotas(target: number, available: number[]): number[] {
  const quotas = available.map(() => 0)
  let remaining = Math.min(Math.max(0, Math.floor(target)), available.reduce((sum, count) => sum + count, 0))
  while (remaining > 0) {
    const active = available
      .map((count, poolIndex) => ({ poolIndex, capacity: count - quotas[poolIndex] }))
      .filter(item => item.capacity > 0)
    if (!active.length)
      break
    const share = Math.floor(remaining / active.length)
    if (share > 0) {
      for (const item of active) {
        const amount = Math.min(share, item.capacity)
        quotas[item.poolIndex] += amount
        remaining -= amount
      }
      continue
    }
    for (const item of active) {
      if (!remaining)
        break
      quotas[item.poolIndex] += 1
      remaining -= 1
    }
  }
  return quotas
}

export function takeBalancedQuestionEntries(pools: SessionEntry[][], target: number, usedQuestionIds: Set<string>, usedSenseIds: Set<string>, preferredSenseIds: Set<string> = new Set()): SessionEntry[] {
  const selected: SessionEntry[] = []
  const quotas = balancedQuotas(target, pools.map(pool => pool.length))
  for (const [index, pool] of pools.entries())
    selected.push(...takeQuestionEntries(pool, quotas[index], usedQuestionIds, usedSenseIds, preferredSenseIds))
  if (selected.length < target)
    selected.push(...takeQuestionEntries(pools.flat(), target - selected.length, usedQuestionIds, usedSenseIds, preferredSenseIds))
  return selected
}

export function takeReadingGroups(groups: SessionEntry[][], target: number, usedQuestionIds: Set<string>, usedSenseIds: Set<string>, preferredSenseIds: Set<string> = new Set()): SessionEntry[] {
  const selected: SessionEntry[] = []
  const availableGroups = shuffleEntries(groups).sort((a, b) => Number(b.some(entry => preferredSenseIds.has(entry.item.id))) - Number(a.some(entry => preferredSenseIds.has(entry.item.id))))
  for (const group of availableGroups) {
    if (selected.length >= target)
      break
    const groupKeys = group.map(entry => entry.question?.questionId)
    if (groupKeys.some(key => !key) || groupKeys.some(key => key && usedQuestionIds.has(key)) || group.some(entry => usedSenseIds.has(entry.item.id)))
      continue
    for (const [index, entry] of group.entries()) {
      const questionKey = groupKeys[index]
      if (!questionKey)
        continue
      usedQuestionIds.add(questionKey)
      usedSenseIds.add(entry.item.id)
    }
    selected.push(...group)
  }
  return selected
}

export function takeBalancedReadingGroups(groups: SessionEntry[][], target: number, usedQuestionIds: Set<string>, usedSenseIds: Set<string>, preferredSenseIds: Set<string> = new Set()): SessionEntry[] {
  const pools = [1, 2, 3].map(difficulty => groups.filter(group => group[0]?.question?.difficulty === difficulty))
  const quotas = balancedQuotas(target, pools.map(pool => pool.reduce((sum, group) => sum + group.length, 0)))
  const selected: SessionEntry[] = []
  for (const [index, pool] of pools.entries())
    selected.push(...takeReadingGroups(pool, quotas[index], usedQuestionIds, usedSenseIds, preferredSenseIds))
  if (selected.length < target)
    selected.push(...takeReadingGroups(groups, target - selected.length, usedQuestionIds, usedSenseIds, preferredSenseIds))
  return selected
}
