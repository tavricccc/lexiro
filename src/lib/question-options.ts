import type { GeneratedQuestionKind } from './question-generation'

export interface TranslatedSelectOption<T extends string = string> {
  value: T
  label: string
}

type Translate = (key: string, values?: Record<string, unknown>) => string

export type QuestionTypeSource = { kind: 'reading' }
  | { kind: 'multipleChoice', questionStyle: 'standard' | 'fillBlank' }

const QUESTION_DIFFICULTIES = [
  ['1', 'library.difficulty1'],
  ['2', 'library.difficulty2'],
  ['3', 'library.difficulty3'],
] as const

function translatedOptions<T extends string>(
  translate: Translate,
  definitions: readonly (readonly [T, string])[],
): TranslatedSelectOption<T>[] {
  return definitions.map(([value, key]) => ({ value, label: translate(key) }))
}

export function createQuestionDifficultyOptions(translate: Translate): TranslatedSelectOption<'1' | '2' | '3'>[] {
  return translatedOptions(translate, QUESTION_DIFFICULTIES)
}

export function createAnswerOptions(translate: Translate, optionCount: number): TranslatedSelectOption<string>[] {
  return Array.from({ length: optionCount }, (_, index) => ({
    value: String(index),
    label: translate('library.answerOption', { index: index + 1 }),
  }))
}

export function createPracticeDifficultyOptions(translate: Translate): TranslatedSelectOption<'all' | '1' | '2' | '3'>[] {
  return [
    { value: 'all', label: translate('study.randomDifficulty') },
    ...createQuestionDifficultyOptions(translate),
  ]
}

export function createVocabularyDifficultyOptions(translate: Translate): TranslatedSelectOption<'all' | '1' | '2' | '3'>[] {
  return [
    { value: 'all', label: translate('library.questionDifficultyAll') },
    ...createQuestionDifficultyOptions(translate),
  ]
}

export function createGeneratedQuestionTypeOptions(translate: Translate): TranslatedSelectOption<GeneratedQuestionKind>[] {
  return translatedOptions(translate, [
    ['multipleChoice', 'library.questionTypeChoice'],
    ['fillBlank', 'library.questionTypeFillBlank'],
    ['reading', 'library.questionTypeReading'],
  ])
}

export function createQuestionEditorTypeOptions(translate: Translate): TranslatedSelectOption<'standard' | 'fillBlank'>[] {
  return translatedOptions(translate, [
    ['standard', 'library.questionTypeChoice'],
    ['fillBlank', 'library.questionTypeFillBlank'],
  ])
}

export function createVocabularyQuestionTypeOptions(translate: Translate): TranslatedSelectOption<'all' | 'standard' | 'fillBlank' | 'reading'>[] {
  return translatedOptions(translate, [
    ['all', 'vocabulary.allQuestionTypes'],
    ['standard', 'library.questionTypeChoice'],
    ['fillBlank', 'library.questionTypeFillBlank'],
    ['reading', 'library.questionTypeReading'],
  ])
}

export function questionTypeLabel(question: QuestionTypeSource, translate: Translate): string {
  if (question.kind === 'reading')
    return translate('library.questionTypeReading')
  return translate(question.questionStyle === 'fillBlank' ? 'library.questionTypeFillBlank' : 'library.questionTypeChoice')
}
