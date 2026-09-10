import type { GeneratedQuestionKind, PassageFormat, QuestionDifficulty, WordEntry } from '@/types'
import { createSourceRef } from './source-ref'
import { isRecord } from './schema'
import { blankToken, PASSAGE_FORMATS, isPassageKind } from './question-formats'
import { libraryDistractors, placeAnswer } from './question-builders'

/**
 * Turns the model's prose into graded questions.
 *
 * The model is asked for complete sentences and the spans that are the answers.
 * Everything else is decided here: where the blank goes, how the blanks are
 * numbered, which option is correct and at what index, and which source sense
 * each item belongs to. A model can therefore be wrong about English — which is
 * recoverable, the item is dropped — but it cannot be wrong about the shape of
 * the data.
 */

export interface AssemblyResult {
  /** Import-shaped payload, ready for `parseLibraryImport` to validate. */
  payload: Record<string, unknown>
  /** Items the model got wrong badly enough to discard, for reporting. */
  dropped: string[]
}

const WORD_CHAR = /[A-Za-z0-9]/

/** Whole-word occurrences of `needle` in `haystack`, as start offsets. */
function occurrences(haystack: string, needle: string): number[] {
  if (!needle)
    return []
  const found: number[] = []
  const lowerHay = haystack.toLocaleLowerCase()
  const lowerNeedle = needle.toLocaleLowerCase()
  let from = 0
  for (;;) {
    const at = lowerHay.indexOf(lowerNeedle, from)
    if (at === -1)
      return found
    const before = at === 0 ? '' : haystack[at - 1]
    const after = haystack[at + needle.length] ?? ''
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after))
      found.push(at)
    from = at + 1
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : []
}

/**
 * Distractors are only usable if they are distinct from each other and from the
 * answer, and are the same shape as the answer (one token for a word-level
 * blank, a sentence for a sentence-level one).
 */
function usableDistractors(answer: string, candidates: string[], count: number): string[] | null {
  const answerKey = answer.toLocaleLowerCase()
  const singleToken = !/\s/.test(answer)
  const seen = new Set<string>([answerKey])
  const kept: string[] = []
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase()
    if (seen.has(key))
      continue
    if (singleToken && /\s/.test(candidate))
      continue
    seen.add(key)
    kept.push(candidate)
    if (kept.length === count)
      return kept
  }
  return null
}

interface SenseSlot {
  ref: string
  sourceRef: string
  word: WordEntry
  senseIndex: number
  wordIndex: number
}

/** Maps the short refs handed to the model back onto the input senses. */
function buildSlots(words: WordEntry[]): SenseSlot[] {
  const slots: SenseSlot[] = []
  words.forEach((word, wordIndex) => {
    word.senses.forEach((_, senseIndex) => {
      slots.push({
        ref: `s${slots.length + 1}`,
        senseIndex,
        sourceRef: createSourceRef(wordIndex, senseIndex),
        word,
        wordIndex,
      })
    })
  })
  return slots
}

/**
 * Resolves an item's `ref`. When the model echoes a ref we know, that wins;
 * when it does not but returned the expected number of items in order, the
 * position is used instead. Repairing beats failing a whole batch over a typo
 * in a field the model only had to copy.
 */
function resolveSlot(slots: SenseSlot[], ref: string, position: number): SenseSlot | null {
  return slots.find(slot => slot.ref === ref) ?? slots[position] ?? null
}

function multipleChoiceItem(
  slot: SenseSlot,
  style: 'vocabulary' | 'grammar',
  prompt: string,
  answer: string,
  distractors: string[],
  difficulty: QuestionDifficulty,
): Record<string, unknown> {
  const { answerIndex, options } = placeAnswer(answer, distractors, `${slot.sourceRef}:${prompt}`)
  return {
    answerIndex,
    difficulty,
    kind: 'multipleChoice',
    options,
    prompt,
    questionStyle: style,
    sourceRef: slot.sourceRef,
  }
}

function assembleSentences(
  value: Record<string, unknown>,
  kind: 'vocabulary' | 'grammar',
  difficulty: QuestionDifficulty,
  words: WordEntry[],
  pool: WordEntry[],
): AssemblyResult {
  const slots = buildSlots(words)
  const items = Array.isArray(value.items) ? value.items : []
  if (!items.length)
    throw new Error('AI 回覆沒有 items')

  const dropped: string[] = []
  const questions: Record<string, unknown>[] = []

  items.forEach((raw, position) => {
    if (!isRecord(raw))
      return dropped.push(`第 ${position + 1} 筆格式錯誤`)
    const slot = resolveSlot(slots, text(raw.ref), position)
    if (!slot)
      return dropped.push(`第 ${position + 1} 筆對不到輸入詞義`)

    const sentence = text(raw.sentence)
    const answer = text(raw.answer)
    if (!sentence || !answer)
      return dropped.push(`${slot.word.word}：缺少句子或答案`)

    // The blank is cut here, never typed by the model.
    const hits = occurrences(sentence, answer)
    if (hits.length !== 1)
      return dropped.push(`${slot.word.word}：答案在句中出現 ${hits.length} 次，必須恰好一次`)
    const prompt = `${sentence.slice(0, hits[0])}_____${sentence.slice(hits[0] + answer.length)}`

    // The answer has to be a form of the word we asked about, or the item is
    // testing something else entirely.
    const stem = slot.word.word.trim().toLocaleLowerCase().slice(0, 4)
    if (stem && !answer.toLocaleLowerCase().startsWith(stem))
      return dropped.push(`${slot.word.word}：答案與目標單字不符`)

    const fromLibrary = answer.toLocaleLowerCase() === slot.word.word.trim().toLocaleLowerCase()
      ? libraryDistractors(slot.word, slot.word.senses[slot.senseIndex]?.pos ?? '', pool, 3, `${slot.sourceRef}:pool`)
      : []
    const distractors = usableDistractors(answer, fromLibrary.length >= 3 ? fromLibrary : stringArray(raw.distractors), 3)
    if (!distractors)
      return dropped.push(`${slot.word.word}：干擾選項不足或重複`)

    questions.push(multipleChoiceItem(slot, kind, prompt, answer, distractors, difficulty))
  })

  if (!questions.length)
    throw new Error(dropped[0] ?? 'AI 回覆沒有可用的題目')
  return { dropped, payload: { kind: 'questions', questions } }
}

interface CutBlank {
  answer: string
  at: number
  slot: SenseSlot | null
}

/** Cuts the named spans out of a passage and numbers the holes in reading order. */
function cutBlanks(passage: string, blanks: CutBlank[]): { children: CutBlank[], passage: string } {
  const ordered = [...blanks].sort((first, second) => first.at - second.at)
  let result = ''
  let cursor = 0
  ordered.forEach((blank, index) => {
    result += passage.slice(cursor, blank.at) + blankToken(index)
    cursor = blank.at + blank.answer.length
  })
  return { children: ordered, passage: result + passage.slice(cursor) }
}

function assemblePassage(
  value: Record<string, unknown>,
  format: PassageFormat,
  difficulty: QuestionDifficulty,
  words: WordEntry[],
): AssemblyResult {
  const spec = PASSAGE_FORMATS[format]
  const slots = buildSlots(words)
  const title = text(value.title)
  const rawPassage = text(value.passage)
  if (!title || !rawPassage)
    throw new Error('AI 回覆缺少標題或文章')

  const wordKeys = words.map((_, wordIndex) => createSourceRef(wordIndex))
  const dropped: string[] = []

  if (format === 'reading') {
    const items = Array.isArray(value.items) ? value.items : []
    const children = items.flatMap((raw, position) => {
      if (!isRecord(raw))
        return []
      const slot = resolveSlot(slots, text(raw.ref), position)
      const question = text(raw.question)
      const answer = text(raw.answer)
      const distractors = usableDistractors(answer, stringArray(raw.distractors), 3)
      if (!slot || !question || !answer || !distractors) {
        dropped.push(`閱讀題第 ${position + 1} 題資料不完整`)
        return []
      }
      const { answerIndex, options } = placeAnswer(answer, distractors, `${slot.sourceRef}:${question}`)
      return [{ answerIndex, kind: 'multipleChoice', options, prompt: question, sourceRef: slot.sourceRef }]
    })
    if (!children.length)
      throw new Error('AI 回覆沒有可用的閱讀子題')
    return {
      dropped,
      payload: {
        kind: 'questions',
        questions: [{ difficulty, format, kind: 'reading', passage: rawPassage, questions: children, title, wordKeys }],
      },
    }
  }

  // Blank formats: locate every answer span in the finished prose, then cut.
  // The source record travels with the answer so the cloze branch can still
  // reach its distractors after the blanks have been sorted into reading order.
  const raw = format === 'discourse'
    ? stringArray(value.removals).map(sentence => ({ answer: sentence, ref: '', source: undefined as Record<string, unknown> | undefined }))
    : (Array.isArray(value.blanks) ? value.blanks : []).flatMap(item =>
        isRecord(item) ? [{ answer: text(item.answer), ref: text(item.ref), source: item }] : [],
      )

  const located: CutBlank[] = []
  raw.forEach((item, position) => {
    const hits = occurrences(rawPassage, item.answer)
    if (hits.length !== 1) {
      dropped.push(`「${item.answer.slice(0, 24)}」在文章中出現 ${hits.length} 次，必須恰好一次`)
      return
    }
    if (located.some(existing => Math.abs(existing.at - hits[0]) < 1)) {
      dropped.push(`「${item.answer.slice(0, 24)}」與其他空格重疊`)
      return
    }
    located.push({ answer: item.answer, at: hits[0], slot: resolveSlot(slots, item.ref, position) })
  })

  if (located.length < 2)
    throw new Error(dropped[0] ?? '文章中找不到足夠的空格位置')

  const { children, passage } = cutBlanks(rawPassage, located)
  const answers = children.map(child => child.answer)

  if (spec.sharedBank) {
    const extras = format === 'discourse'
      ? [text(value.extraOption)].filter(Boolean)
      : stringArray(value.extraOptions)
    const bank = placeAnswer(answers[0], [...answers.slice(1), ...extras], `${title}:bank`).options
    return {
      dropped,
      payload: {
        kind: 'questions',
        questions: [{
          difficulty,
          format,
          kind: 'reading',
          optionBank: bank,
          passage,
          questions: children.map((child, index) => ({
            answerIndex: bank.indexOf(child.answer),
            blank: index + 1,
            kind: 'multipleChoice',
            options: bank,
            prompt: `Blank ${index + 1}`,
            sourceRef: (child.slot ?? slots[index % slots.length]).sourceRef,
          })),
          title,
          wordKeys,
        }],
      },
    }
  }

  // Cloze: every blank keeps its own four options.
  const sourceByAnswer = new Map(raw.map(item => [item.answer.toLocaleLowerCase(), item.source]))
  const questions = children.flatMap((child, index) => {
    const source = sourceByAnswer.get(child.answer.toLocaleLowerCase())
    const distractors = usableDistractors(child.answer, stringArray(source?.distractors), 3)
    if (!distractors) {
      dropped.push(`第 ${index + 1} 格干擾選項不足`)
      return []
    }
    const { answerIndex, options } = placeAnswer(child.answer, distractors, `${title}:${index}`)
    return [{
      answerIndex,
      blank: index + 1,
      kind: 'multipleChoice',
      options,
      prompt: `Blank ${index + 1}`,
      sourceRef: (child.slot ?? slots[index % slots.length]).sourceRef,
    }]
  })
  if (!questions.length)
    throw new Error(dropped[0] ?? 'AI 回覆沒有可用的空格')

  // Renumber, because a dropped blank would otherwise leave a gap in the passage.
  const kept = new Set(questions.map(question => question.blank))
  let renumbered = passage
  let next = 1
  for (let index = 1; index <= children.length; index += 1) {
    renumbered = kept.has(index)
      ? renumbered.replace(blankToken(index - 1), blankToken(next++ - 1))
      : renumbered.replace(blankToken(index - 1), children[index - 1].answer)
  }
  questions.forEach((question, index) => {
    question.blank = index + 1
    question.prompt = `Blank ${index + 1}`
  })

  return {
    dropped,
    payload: {
      kind: 'questions',
      questions: [{ difficulty, format, kind: 'reading', passage: renumbered, questions, title, wordKeys }],
    },
  }
}

export function assembleGeneratedQuestions(
  value: unknown,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
  words: WordEntry[],
  pool: WordEntry[],
): AssemblyResult {
  if (!isRecord(value))
    throw new Error('AI 回覆必須是 JSON object')
  return isPassageKind(kind)
    ? assemblePassage(value, kind, difficulty, words)
    : assembleSentences(value, kind, difficulty, words, pool)
}
