import type { AnswerRecord, PracticeQuestion, ResultRow, SessionEntry } from '@/types'
import prompts, { fillPrompt } from '@/lib/prompts'

export function formatQuestionOptions(question: Pick<PracticeQuestion, 'options'>) {
  return question.options.map((option, index) => `- (${String.fromCharCode(65 + index)}) ${option}`).join('\n')
}

function formatQuestionType(type: PracticeQuestion['questionType']): string {
  if (type === 'fillBlank')
    return '填空題'
  if (type === 'reading')
    return '閱讀理解'
  return '一般四選一'
}

export function buildQuestionExplainPrompt(
  entry: SessionEntry,
  record: AnswerRecord | null,
  notAnsweredText: string,
) {
  const question = entry.question
  if (!question)
    return ''
  return fillPrompt(prompts.explainQuestion, {
    '{{QUESTION}}': question.prompt,
    '{{QUESTION_TYPE}}': formatQuestionType(question.questionType),
    '{{DIFFICULTY}}': String(question.difficulty),
    '{{OPTIONS}}': formatQuestionOptions(question),
    '{{USER_ANSWER}}': record?.userAnswer ?? notAnsweredText,
    '{{CORRECT_ANSWER}}': question.options[question.answerIndex],
    '{{MEANING}}': entry.item.meaning,
    '{{EXAMPLE}}': entry.item.example || '無',
    '{{PASSAGE}}': entry.readingPassage ?? '無',
  })
}

export function buildAllWrongQuestionsPrompt(rows: ResultRow[]) {
  const readingPassages: Record<string, string> = {}
  const passageRefs = new Map<string, string>()
  const wrongQuestions = rows.map((row, idx) => {
    const entry = row.entry
    const record = row.record
    const q = entry.question
    if (!q) {
      return { number: idx + 1, word: entry.item.word, question: null }
    }
    const passageKey = entry.readingPackId ?? entry.readingPassage
    let passageRef: string | undefined
    if (entry.readingPassage && passageKey) {
      passageRef = passageRefs.get(passageKey)
      if (!passageRef) {
        passageRef = `reading-${passageRefs.size + 1}`
        passageRefs.set(passageKey, passageRef)
        readingPassages[passageRef] = entry.readingPassage
      }
    }
    return {
      number: idx + 1,
      word: entry.item.word,
      meaning: entry.item.meaning,
      example: entry.item.example || undefined,
      type: formatQuestionType(q.questionType),
      difficulty: q.difficulty,
      question: q.prompt,
      options: q.options,
      userAnswer: record?.userAnswer ?? '未作答',
      correctAnswer: q.options[q.answerIndex],
      ...(passageRef ? { passageRef } : {}),
    }
  })

  return fillPrompt(prompts.explainAllWrongQuestions, {
    '{{WRONG_QUESTIONS}}': JSON.stringify({ readingPassages, wrongQuestions }, null, 2),
  })
}
