import type { AnswerRecord, PracticeQuestion, ResultRow, SessionEntry } from '@/types'
import prompts from '@/lib/prompts'

export function formatQuestionOptions(question: Pick<PracticeQuestion, 'options'>) {
  return question.options.map((option, index) => `- (${String.fromCharCode(65 + index)}) ${option}`).join('\n')
}

export function buildQuestionExplainPrompt(
  entry: SessionEntry,
  record: AnswerRecord | null,
  notAnsweredText: string,
) {
  const question = entry.question
  if (!question)
    return ''
  return prompts.explainQuestion
    .replace('{{QUESTION}}', question.prompt)
    .replace('{{OPTIONS}}', formatQuestionOptions(question))
    .replace('{{USER_ANSWER}}', record?.userAnswer ?? notAnsweredText)
    .replace('{{CORRECT_ANSWER}}', question.options[question.answerIndex])
    .replace('{{MEANING}}', entry.item.meaning)
    .replace('{{EXAMPLE}}', entry.item.example)
}

export function buildAllWrongQuestionsPrompt(rows: ResultRow[]) {
  const wrongQuestionsText = rows.map((row, idx) => {
    const entry = row.entry
    const record = row.record
    let text = `【第 ${idx + 1} 題】 單字：${entry.item.word}\n`

    const q = entry.question
    if (!q)
      return text
    text += `題目：${q.prompt}\n`
    text += `選項：\n${formatQuestionOptions(q)}\n`
    text += `我的答案：${record?.userAnswer ?? '未作答'}\n`
    text += `正確答案：${q.options[q.answerIndex]}\n`
    return text
  }).join('\n-------------------\n\n')

  return prompts.explainAllWrongQuestions.replace('{{WRONG_QUESTIONS}}', wrongQuestionsText)
}
