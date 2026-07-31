import type { AnswerRecord, PracticeMode, ResultRow, SessionEntry } from '@/types'
import prompts from '@/lib/prompts'

export function formatQuestionOptions(question: { opts: string[] }) {
  return question.opts.map((option, index) => `- (${String.fromCharCode(65 + index)}) ${option}`).join('\n')
}

export function buildQuestionExplainPrompt(
  entry: SessionEntry,
  record: AnswerRecord | null,
  mode: PracticeMode,
  notAnsweredText: string,
) {
  if (['quiz', 'cloze', 'reading'].includes(mode)) {
    const question = entry.item.question
    if (!question) {
      return prompts.explainSpellingQuestion
        .replace('{{MEANING}}', entry.item.meaning)
        .replace('{{EXAMPLE}}', entry.item.example)
        .replace('{{USER_ANSWER}}', record?.userAnswer ?? notAnsweredText)
        .replace('{{CORRECT_ANSWER}}', entry.item.word)
    }
    return prompts.explainQuestion
      .replace('{{QUESTION}}', question.prompt)
      .replace('{{OPTIONS}}', formatQuestionOptions(question))
      .replace('{{USER_ANSWER}}', record?.userAnswer ?? notAnsweredText)
      .replace('{{CORRECT_ANSWER}}', question.opts[question.ans])
      .replace('{{MEANING}}', entry.item.meaning)
      .replace('{{EXAMPLE}}', entry.item.example)
  }

  return prompts.explainSpellingQuestion
    .replace('{{MEANING}}', entry.item.meaning)
    .replace('{{EXAMPLE}}', entry.item.example)
    .replace('{{USER_ANSWER}}', record?.userAnswer ?? notAnsweredText)
    .replace('{{CORRECT_ANSWER}}', entry.item.word)
}

export function buildAllWrongQuestionsPrompt(rows: ResultRow[], mode: PracticeMode) {
  const wrongQuestionsText = rows.map((row, idx) => {
    const entry = row.entry
    const record = row.record
    let text = `【第 ${idx + 1} 題】 單字：${entry.item.word}\n`

    if (['quiz', 'cloze', 'reading'].includes(mode)) {
      const q = entry.item.question
      if (!q)
        return text
      text += `題目：${q.prompt}\n`
      text += `選項：\n${formatQuestionOptions(q)}\n`
      text += `我的答案：${record?.userAnswer ?? '未作答'}\n`
      text += `正確答案：${q.opts[q.ans]}\n`
    }
    else {
      text += `單字字義：${entry.item.meaning}\n`
      text += `例句：${entry.item.example}\n`
      text += `我的答案：${record?.userAnswer ?? '未作答'}\n`
      text += `正確答案：${entry.item.word}\n`
    }
    return text
  }).join('\n-------------------\n\n')

  return prompts.explainAllWrongQuestions.replace('{{WRONG_QUESTIONS}}', wrongQuestionsText)
}
