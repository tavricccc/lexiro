import type { MultipleChoiceQuestion, PracticeQuestion, ReadingChildQuestion, ReadingPack } from '@/types'

export function toPracticeQuestion(question: MultipleChoiceQuestion): PracticeQuestion {
  return {
    questionId: question.id,
    questionType: question.questionStyle,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: [...question.options],
    answerIndex: question.answerIndex,
  }
}

export function toReadingPracticeQuestion(pack: Pick<ReadingPack, 'difficulty'>, question: ReadingChildQuestion): PracticeQuestion {
  return {
    questionId: question.id,
    questionType: 'reading',
    difficulty: pack.difficulty,
    prompt: question.prompt,
    options: [...question.options],
    answerIndex: question.answerIndex,
  }
}
