import type { AnswerRecord, ResultRow, SessionEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildAllWrongQuestionsPrompt, buildQuestionExplainPrompt } from '@/lib/resultPrompts'

function entry(index: number): SessionEntry {
  return {
    item: {
      id: `sense-${index}`,
      wordKey: 'adapt',
      word: 'adapt',
      pos: 'v.',
      meaning: '適應',
      examples: ['We adapt quickly.'],
      example: 'We adapt quickly.',
    },
    question: {
      questionId: `question-${index}`,
      questionType: 'reading',
      difficulty: 3,
      prompt: 'What does the character do?',
      options: ['Adapt quickly.', 'Leave early.', 'Wait silently.', 'Stop learning.'],
      answerIndex: 0,
    },
    originalIndex: index,
    readingPassage: 'The character adapts quickly to the new environment.',
    readingPackId: 'reading-pack-1',
  }
}

function record(): AnswerRecord {
  return {
    type: 'quiz',
    selectedIndex: 1,
    userAnswer: 'Leave early.',
    correctAnswer: 'Adapt quickly.',
    isCorrect: false,
    skipped: false,
  }
}

describe('ai result prompts', () => {
  it('includes question type, difficulty, and reading evidence', () => {
    const prompt = buildQuestionExplainPrompt(entry(0), record(), '未作答')

    expect(prompt).toContain('閱讀理解／3')
    expect(prompt).toContain('閱讀文章：The character adapts quickly')
    expect(prompt).toContain('正確答案：Adapt quickly.')
    expect(prompt).toContain('回答前請在心中自我驗證')
  })

  it('does not repeat the same reading passage for every wrong child question', () => {
    const rows: ResultRow[] = [
      { entry: entry(0), record: record(), index: 0 },
      { entry: entry(1), record: record(), index: 1 },
    ]
    const prompt = buildAllWrongQuestionsPrompt(rows)

    expect(prompt).toContain('"readingPassages"')
    expect(prompt).toContain('"passageRef": "reading-1"')
    expect(prompt).toContain('"type": "閱讀理解"')
    expect(prompt.match(/The character adapts quickly/g)).toHaveLength(1)
    expect(prompt).toContain('錯誤模式：歸納重複出現的問題')
    expect(prompt).toContain('回答前請在心中自我驗證')
  })
})
