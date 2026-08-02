import { describe, expect, it } from 'vitest'
import {
  createAnswerOptions,
  createGeneratedQuestionTypeOptions,
  createPracticeDifficultyOptions,
  createQuestionDifficultyOptions,
  createQuestionEditorTypeOptions,
  createVocabularyDifficultyOptions,
  createVocabularyQuestionTypeOptions,
  questionTypeLabel,
} from '@/lib/question-options'

const translate = (key: string, values?: Record<string, unknown>) => values ? `translated:${key}:${String(values.index)}` : `translated:${key}`

describe('question option builders', () => {
  it('builds translated answer options for the provided count', () => {
    expect(createAnswerOptions(translate, 4)).toEqual([
      { value: '0', label: 'translated:library.answerOption:1' },
      { value: '1', label: 'translated:library.answerOption:2' },
      { value: '2', label: 'translated:library.answerOption:3' },
      { value: '3', label: 'translated:library.answerOption:4' },
    ])
  })

  it('keeps canonical difficulty values while translating labels', () => {
    expect(createQuestionDifficultyOptions(translate)).toEqual([
      { value: '1', label: 'translated:library.difficulty1' },
      { value: '2', label: 'translated:library.difficulty2' },
      { value: '3', label: 'translated:library.difficulty3' },
    ])
  })

  it('preserves each screen-specific all option', () => {
    expect(createPracticeDifficultyOptions(translate)[0]).toEqual({ value: 'all', label: 'translated:study.randomDifficulty' })
    expect(createVocabularyDifficultyOptions(translate)[0]).toEqual({ value: 'all', label: 'translated:library.questionDifficultyAll' })
  })

  it('keeps generated and editor question type values distinct', () => {
    expect(createGeneratedQuestionTypeOptions(translate).map(option => option.value)).toEqual(['multipleChoice', 'fillBlank', 'reading'])
    expect(createQuestionEditorTypeOptions(translate).map(option => option.value)).toEqual(['standard', 'fillBlank'])
    expect(createVocabularyQuestionTypeOptions(translate).map(option => option.value)).toEqual(['all', 'standard', 'fillBlank', 'reading'])
  })

  it('translates canonical question kinds from one rule', () => {
    expect(questionTypeLabel({ kind: 'reading' }, translate)).toBe('translated:library.questionTypeReading')
    expect(questionTypeLabel({ kind: 'multipleChoice', questionStyle: 'fillBlank' }, translate)).toBe('translated:library.questionTypeFillBlank')
    expect(questionTypeLabel({ kind: 'multipleChoice', questionStyle: 'standard' }, translate)).toBe('translated:library.questionTypeChoice')
  })
})
