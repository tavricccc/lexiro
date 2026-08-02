import type { LibraryQuestion, SessionEntry, StudyWord } from '@/types'
import { toPracticeQuestion } from './practice-question'
import { allocateDailyQuestionQuotas } from './question-distribution'
import { readingGroupsForItems, takeBalancedQuestionEntries, takeBalancedReadingGroups, takeReadingGroups } from './session-selection'
import { shuffleEntries } from './shuffle'

function questionEntriesForStyle(style: 'standard' | 'fillBlank', questions: LibraryQuestion[], words: Map<string, StudyWord>, preferredSenseIds: Set<string>): SessionEntry[] {
  const entries: SessionEntry[] = []
  for (const question of questions) {
    if (question.kind !== 'multipleChoice' || question.questionStyle !== style || !question.senseId)
      continue
    const item = words.get(question.senseId)
    if (!item || item.wordKey !== question.wordKey)
      continue
    entries.push({ item, question: toPracticeQuestion(question), originalIndex: 0 })
  }
  return entries.sort((a, b) => Number(preferredSenseIds.has(b.item.id)) - Number(preferredSenseIds.has(a.item.id)))
}

function readingQuestionGroups(questions: LibraryQuestion[], words: Map<string, StudyWord>, preferredSenseIds: Set<string>): SessionEntry[][] {
  return readingGroupsForItems(questions, Array.from(words.values())).sort((a, b) => Number(b.some(entry => preferredSenseIds.has(entry.item.id))) - Number(a.some(entry => preferredSenseIds.has(entry.item.id))))
}

export function buildDailyQuestionEntries(questions: LibraryQuestion[], words: Map<string, StudyWord>, preferredSenseIds: Set<string>, target: number): SessionEntry[] {
  if (target <= 0)
    return []

  const standard = questionEntriesForStyle('standard', questions, words, preferredSenseIds)
  const fillBlank = questionEntriesForStyle('fillBlank', questions, words, preferredSenseIds)
  const readingGroups = readingQuestionGroups(questions, words, preferredSenseIds)
  const usedQuestionIds = new Set<string>()
  const usedSenseIds = new Set<string>()
  const [standardTarget, fillBlankTarget, readingTarget] = allocateDailyQuestionQuotas(target)
  const selected = [
    ...takeBalancedQuestionEntries([1, 2, 3].map(difficulty => standard.filter(entry => entry.question?.difficulty === difficulty)), standardTarget, usedQuestionIds, usedSenseIds, preferredSenseIds),
    ...takeBalancedQuestionEntries([1, 2, 3].map(difficulty => fillBlank.filter(entry => entry.question?.difficulty === difficulty)), fillBlankTarget, usedQuestionIds, usedSenseIds, preferredSenseIds),
    ...takeBalancedReadingGroups(readingGroups, readingTarget, usedQuestionIds, usedSenseIds, preferredSenseIds),
  ]
  const remaining = Math.max(0, target - selected.length)
  if (remaining) {
    const supplementalCandidates = [...standard, ...fillBlank]
    selected.push(...takeBalancedQuestionEntries([1, 2, 3].map(difficulty => supplementalCandidates.filter(entry => entry.question?.difficulty === difficulty)), remaining, usedQuestionIds, usedSenseIds, preferredSenseIds))
    const remainingQuestions = target - selected.length
    if (remainingQuestions > 0)
      selected.push(...takeReadingGroups(readingGroups, remainingQuestions, usedQuestionIds, usedSenseIds, preferredSenseIds))
  }
  const blocks: SessionEntry[][] = []
  for (const entry of selected) {
    const previous = blocks.at(-1)
    if (entry.readingPackId && previous?.[0]?.readingPackId === entry.readingPackId)
      previous.push(entry)
    else
      blocks.push([entry])
  }
  return shuffleEntries(blocks).flat()
}
