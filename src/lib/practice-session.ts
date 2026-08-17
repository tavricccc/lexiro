import type {
  PracticeSessionSnapshot,
  WorkspacePracticeMode,
  WorkspaceQuestionDifficulty,
  WorkspaceQuestionType,
} from '@/types'
import { isRecord } from './schema'

const MODES = new Set<WorkspacePracticeMode>(['review', 'questions'])
const QUESTION_TYPES = new Set<WorkspaceQuestionType>(['all', 'standard', 'fillBlank', 'reading'])
const DIFFICULTIES = new Set<WorkspaceQuestionDifficulty>(['all', '1', '2', '3'])

function isIntegerArray(value: unknown, upperBound: number): value is number[] {
  return Array.isArray(value)
    && value.every(item => Number.isInteger(item) && item >= 0 && item < upperBound)
    && new Set(value).size === value.length
}

export function parsePracticeSession(raw: string | null): PracticeSessionSnapshot | null {
  if (!raw)
    return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    return null
  }
  if (!isRecord(value) || value.schemaVersion !== 1)
    return null

  const itemIds = value.itemIds
  const mode = value.mode
  const questionType = value.questionType
  const difficulty = value.difficulty
  if (!Array.isArray(itemIds)
    || itemIds.length === 0
    || itemIds.length > 100
    || !itemIds.every(item => typeof item === 'string' && item.trim())
    || new Set(itemIds).size !== itemIds.length
    || typeof mode !== 'string'
    || !MODES.has(mode as WorkspacePracticeMode)
    || typeof questionType !== 'string'
    || !QUESTION_TYPES.has(questionType as WorkspaceQuestionType)
    || typeof difficulty !== 'string'
    || !DIFFICULTIES.has(difficulty as WorkspaceQuestionDifficulty)
    || typeof value.setId !== 'string'
    || !Number.isInteger(value.amount)
    || Number(value.amount) < 1
    || Number(value.amount) > 100
    || !Number.isInteger(value.index)
    || Number(value.index) < 0
    || Number(value.index) >= itemIds.length
    || !Number.isInteger(value.correct)
    || Number(value.correct) < 0
    || Number(value.correct) > Number(value.index) + (value.selected === null ? 0 : 1)
    || (value.selected !== null && (!Number.isInteger(value.selected) || Number(value.selected) < 0 || Number(value.selected) > 3))
    || typeof value.revealed !== 'boolean'
    || typeof value.retrying !== 'boolean'
    || !Array.isArray(value.failedSenseIds)
    || !value.failedSenseIds.every(item => typeof item === 'string' && item.trim())
    || new Set(value.failedSenseIds).size !== value.failedSenseIds.length
    || !isIntegerArray(value.wrong, itemIds.length)
    || !isIntegerArray(value.skipped, itemIds.length)
    || !isIntegerArray(value.marked, itemIds.length)) {
    return null
  }

  return {
    schemaVersion: 1,
    mode: mode as WorkspacePracticeMode,
    setId: value.setId,
    amount: Number(value.amount),
    index: Number(value.index),
    correct: Number(value.correct),
    wrong: value.wrong,
    skipped: value.skipped,
    marked: value.marked,
    selected: value.selected === null ? null : Number(value.selected),
    revealed: value.revealed,
    questionType: questionType as WorkspaceQuestionType,
    difficulty: difficulty as WorkspaceQuestionDifficulty,
    itemIds,
    failedSenseIds: value.failedSenseIds,
    retrying: value.retrying,
  }
}
