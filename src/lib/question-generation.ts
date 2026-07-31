import type { WordEntry } from '@/types'

export type GeneratedQuestionKind = 'multipleChoice' | 'cloze' | 'reading'

export function buildQuestionGenerationPrompt(words: WordEntry[], kind: GeneratedQuestionKind): string {
  const wordList = words.map(word => ({
    word: word.word,
    senses: word.senses.map(sense => ({ pos: sense.pos, meaningZh: sense.meaningZh, definitionEn: sense.definitionEn, examples: sense.examples })),
  }))
  const common = `你是英文教材編輯。只使用以下單字與詞義，不要自行新增單字。輸出只能是 JSON object，不要 Markdown。題型為 ${kind}。\n\n單字資料：\n${JSON.stringify(wordList, null, 2)}`
  if (kind === 'reading') {
    return `${common}\n\n請產生一篇自然、適合學習的短文與 3 到 5 個閱讀問題。格式：{"kind":"questions","questionKind":"reading","questions":[{"id":"由你產生","kind":"reading","title":"標題","passage":"文章","wordKeys":["單字"],"questions":[{"id":"","kind":"multipleChoice","prompt":"","options":["","","",""],"answerIndex":0,"wordKey":"可選"}]}]}。每批只產生一個 reading pack，問題必須能由文章判斷。`
  }
  if (kind === 'cloze') {
    return `${common}\n\n每個單字產生一題填空，共 ${words.length} 題。格式：{"kind":"questions","questionKind":"cloze","questions":[{"id":"由你產生","kind":"cloze","wordKey":"單字小寫","senseId":"可選","prompt":"包含 _____ 的英文句子","answers":["正確答案"]}]}。每題只能有明確答案，answers 至少一個。`
  }
  return `${common}\n\n每個單字產生一題四選一，共 ${words.length} 題。格式：{"kind":"questions","questionKind":"multipleChoice","questions":[{"id":"由你產生","kind":"multipleChoice","wordKey":"單字小寫","senseId":"可選","prompt":"包含 _____ 的英文句子","options":["正確單字","錯誤選項1","錯誤選項2","錯誤選項3"],"answerIndex":0}]}。options 必須剛好 4 個，answerIndex 必須指向唯一正確答案。`
}
