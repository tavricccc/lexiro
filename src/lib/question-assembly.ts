import type {
  GeneratedQuestionKind,
  PassageFormat,
  QuestionDifficulty,
  WordEntry,
} from "@/types";
import { createSourceRef } from "./source-ref";
import { isRecord } from "./schema";
import { blankToken, PASSAGE_FORMATS, isPassageKind } from "./question-formats";
import { placeAnswer } from "./question-builders";
import { assembleOptionTeaching } from "./question-teaching";
import { sourceWordFormIssue } from "./question-word-forms";
import {
  locateUsageAnswer,
  wordOccurrences as occurrences,
} from "./question-spans";

/**
 * Turns the model's prose into graded questions.
 *
 * The model is asked for complete sentences and the spans that are the answers.
 * Everything else is decided here: where the blank goes, how the blanks are
 * numbered, which option is correct and at what index, and which source sense
 * each item belongs to. Structural errors are dropped here; semantic quality
 * stays visible for review before the user saves the questions.
 */

export interface AssemblyResult {
  /** Import-shaped payload, ready for `parseLibraryImport` to validate. */
  payload: Record<string, unknown>;
  /** Items the model got wrong badly enough to discard, for reporting. */
  dropped: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : [];
}

/**
 * Distractors are only usable if they are distinct from each other and from the
 * answer, and are the same shape as the answer (one token for a word-level
 * blank, a sentence for a sentence-level one).
 */
function usableDistractors(
  answer: string,
  candidates: string[],
  count: number,
  allowPhrases = false,
): string[] | null {
  const answerKey = answer.toLocaleLowerCase();
  const singleToken = !/\s/.test(answer);
  const seen = new Set<string>([answerKey]);
  const kept: string[] = [];
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase();
    if (seen.has(key)) continue;
    if (!allowPhrases && singleToken && /\s/.test(candidate)) continue;
    seen.add(key);
    kept.push(candidate);
    if (kept.length === count) return kept;
  }
  return null;
}

interface SenseSlot {
  ref: string;
  sourceRef: string;
  word: WordEntry;
  senseIndex: number;
}

/** Maps the short refs handed to the model back onto the input senses. */
function buildSlots(words: WordEntry[]): SenseSlot[] {
  const slots: SenseSlot[] = [];
  words.forEach((word, wordIndex) => {
    word.senses.forEach((_, senseIndex) => {
      slots.push({
        ref: `s${slots.length + 1}`,
        senseIndex,
        sourceRef: createSourceRef(wordIndex, senseIndex),
        word,
      });
    });
  });
  return slots;
}

/**
 * Source ownership is positional and assigned here rather than echoed by the
 * model. Reading can contain more questions than source senses, so it cycles
 * through the supplied slots; other formats already require one item per slot.
 */
function resolveSlot(
  slots: SenseSlot[],
  ref: string,
  position: number,
): SenseSlot | null {
  if (!slots.length) return null;
  return (
    slots.find((slot) => slot.ref === ref) ?? slots[position % slots.length]
  );
}

function multipleChoiceItem(
  slot: SenseSlot,
  style: "vocabulary",
  prompt: string,
  answer: string,
  distractors: string[],
  difficulty: QuestionDifficulty,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const { answerIndex, options } = placeAnswer(
    answer,
    distractors,
    `${slot.sourceRef}:${prompt}`,
  );
  return {
    answerIndex,
    difficulty,
    kind: "multipleChoice",
    options,
    prompt,
    questionStyle: style,
    sourceRef: slot.sourceRef,
    ...assembleOptionTeaching(source, distractors),
  };
}

function assembleSentences(
  value: Record<string, unknown>,
  kind: "vocabulary",
  difficulty: QuestionDifficulty,
  words: WordEntry[],
): AssemblyResult {
  const slots = buildSlots(words);
  const items = Array.isArray(value.items) ? value.items : [];
  if (!items.length) throw new Error("AI 回覆沒有 items");

  const dropped: string[] = [];
  const questions: Record<string, unknown>[] = [];

  items.forEach((raw, position) => {
    if (!isRecord(raw)) return dropped.push(`第 ${position + 1} 筆格式錯誤`);
    const slot = resolveSlot(slots, text(raw.ref), position);
    if (!slot) return dropped.push(`第 ${position + 1} 筆對不到輸入詞義`);

    const sentence = text(raw.sentence);
    const answer = text(raw.answer);
    const usage = text(raw.usage);
    if (!sentence || !answer || !usage)
      return dropped.push(`${slot.word.word}：缺少句子、目標用法或答案`);
    const location = locateUsageAnswer(sentence, usage, answer);
    if ("issue" in location)
      return dropped.push(`${slot.word.word}：${location.issue}`);
    const wordFormIssue = sourceWordFormIssue(
      slot.word.word,
      slot.word.senses[slot.senseIndex].pos,
      answer,
      usage,
    );
    if (wordFormIssue) return dropped.push(wordFormIssue);
    const answerAt = location.at;
    const prompt = `${sentence.slice(0, answerAt)}_____${sentence.slice(answerAt + answer.length)}`;

    const distractors = usableDistractors(
      answer,
      stringArray(raw.distractors),
      3,
      true,
    );
    if (!distractors)
      return dropped.push(`${slot.word.word}：干擾選項不足或重複`);

    questions.push(
      multipleChoiceItem(
        slot,
        kind,
        prompt,
        answer,
        distractors,
        difficulty,
        raw,
      ),
    );
  });

  if (!questions.length) throw new Error(dropped[0] ?? "AI 回覆沒有可用的題目");
  return { dropped, payload: { kind: "questions", questions } };
}

interface CutBlank {
  answer: string;
  at: number;
  slot: SenseSlot | null;
  source: Record<string, unknown>;
}

/** Cuts the named spans out of a passage and numbers the holes in reading order. */
function cutBlanks(
  passage: string,
  blanks: CutBlank[],
): { children: CutBlank[]; passage: string } {
  const ordered = [...blanks].sort((first, second) => first.at - second.at);
  let result = "";
  let cursor = 0;
  ordered.forEach((blank, index) => {
    result += passage.slice(cursor, blank.at) + blankToken(index);
    cursor = blank.at + blank.answer.length;
  });
  return { children: ordered, passage: result + passage.slice(cursor) };
}

function assemblePassage(
  value: Record<string, unknown>,
  format: PassageFormat,
  difficulty: QuestionDifficulty,
  words: WordEntry[],
): AssemblyResult {
  const spec = PASSAGE_FORMATS[format];
  const slots = buildSlots(words);
  const title = text(value.title);
  const rawPassage = text(value.passage);
  if (!title || !rawPassage) throw new Error("AI 回覆缺少標題或文章");

  const wordKeys = words.map((_, wordIndex) => createSourceRef(wordIndex));
  const dropped: string[] = [];

  if (format === "reading") {
    const items = Array.isArray(value.items) ? value.items : [];
    const children = items.flatMap((raw, position) => {
      if (!isRecord(raw)) return [];
      const slot = resolveSlot(slots, text(raw.ref), position);
      const question = text(raw.question);
      const answer = text(raw.answer);
      const distractors = usableDistractors(
        answer,
        stringArray(raw.distractors),
        3,
      );
      if (!slot || !question || !answer || !distractors) {
        dropped.push(`閱讀題第 ${position + 1} 題資料不完整`);
        return [];
      }
      const { answerIndex, options } = placeAnswer(
        answer,
        distractors,
        `${slot.sourceRef}:${question}`,
      );
      return [
        {
          answerIndex,
          kind: "multipleChoice",
          options,
          prompt: question,
          sourceRef: slot.sourceRef,
          ...assembleOptionTeaching(raw, distractors),
        },
      ];
    });
    if (!children.length) throw new Error("AI 回覆沒有可用的閱讀子題");
    return {
      dropped,
      payload: {
        kind: "questions",
        questions: [
          {
            difficulty,
            format,
            kind: "reading",
            passage: rawPassage,
            questions: children,
            title,
            wordKeys,
          },
        ],
      },
    };
  }

  // Blank formats: locate every answer span in the finished prose, then cut.
  // The source record travels with the answer so the cloze branch can still
  // reach its distractors after the blanks have been sorted into reading order.
  const raw =
    format === "discourse"
      ? (Array.isArray(value.removals) ? value.removals : [])
          .filter(isRecord)
          .map((item) => ({
            answer: text(item.sentence),
            usage: "",
            ref: "",
            source: item,
          }))
      : (Array.isArray(value.blanks) ? value.blanks : []).flatMap((item) =>
          isRecord(item)
            ? [
                {
                  answer: text(item.answer),
                  usage: text(item.usage),
                  ref: text(item.ref),
                  source: item,
                },
              ]
            : [],
        );

  const located: CutBlank[] = [];
  raw.forEach((item, position) => {
    const slot = resolveSlot(slots, item.ref, position);
    let at: number;
    if (format === "discourse") {
      const hits = occurrences(rawPassage, item.answer);
      if (hits.length !== 1) {
        dropped.push(
          `「${item.answer.slice(0, 24)}」在文章中出現 ${hits.length} 次，必須恰好一次`,
        );
        return;
      }
      at = hits[0];
    } else {
      const location = locateUsageAnswer(rawPassage, item.usage, item.answer);
      if ("issue" in location) {
        dropped.push(`第 ${position + 1} 格：${location.issue}`);
        return;
      }
      at = location.at;
    }
    if (format === "wordBank" && slot) {
      const wordFormIssue = sourceWordFormIssue(
        slot.word.word,
        slot.word.senses[slot.senseIndex].pos,
        item.answer,
        item.usage,
      );
      if (wordFormIssue) {
        dropped.push(wordFormIssue);
        return;
      }
    }
    if (
      located.some(
        (existing) =>
          at < existing.at + existing.answer.length &&
          existing.at < at + item.answer.length,
      )
    ) {
      dropped.push(`「${item.answer.slice(0, 24)}」與其他空格重疊`);
      return;
    }
    located.push({
      answer: item.answer,
      at,
      slot,
      source: item.source,
    });
  });

  if (!located.length)
    throw new Error(dropped[0] ?? "文章中找不到可用的空格位置");

  const { children, passage } = cutBlanks(rawPassage, located);
  const answers = children.map((child) => child.answer);

  if (spec.sharedBank) {
    const candidates = stringArray(value.options);
    if (
      candidates.length !== spec.optionCount ||
      new Set(candidates.map((option) => option.toLocaleLowerCase())).size !==
        candidates.length ||
      answers.some((answer) => !candidates.includes(answer))
    )
      throw new Error(
        `共用選項必須有 ${spec.optionCount} 個不重複選項並包含每格答案`,
      );
    if (
      new Set(answers.map((answer) => answer.toLocaleLowerCase())).size !==
      answers.length
    )
      throw new Error("共用選項的每個答案只能配置到一個空格");
    const bank = placeAnswer(
      candidates[0],
      candidates.slice(1),
      `${title}:bank`,
    ).options;
    return {
      dropped,
      payload: {
        kind: "questions",
        questions: [
          {
            difficulty,
            format,
            kind: "reading",
            optionBank: bank,
            passage,
            questions: children.map((child, index) => ({
              answerIndex: bank.indexOf(child.answer),
              blank: index + 1,
              kind: "multipleChoice",
              options: bank,
              prompt: `Blank ${index + 1}`,
              sourceRef: (child.slot ?? slots[index % slots.length]).sourceRef,
              ...assembleOptionTeaching(
                child.source,
                candidates.filter((option) => option !== child.answer),
              ),
            })),
            title,
            wordKeys,
          },
        ],
      },
    };
  }

  // Cloze: every blank keeps its own four options.
  const questions = children.flatMap((child, index) => {
    const source = child.source;
    const distractors = usableDistractors(
      child.answer,
      stringArray(source?.distractors),
      3,
      true,
    );
    if (!distractors) {
      dropped.push(`第 ${index + 1} 格干擾選項不足`);
      return [];
    }
    const { answerIndex, options } = placeAnswer(
      child.answer,
      distractors,
      `${title}:${index}`,
    );
    return [
      {
        answerIndex,
        blank: index + 1,
        kind: "multipleChoice",
        options,
        prompt: `Blank ${index + 1}`,
        sourceRef: (child.slot ?? slots[index % slots.length]).sourceRef,
        ...assembleOptionTeaching(source, distractors),
      },
    ];
  });
  if (!questions.length) throw new Error(dropped[0] ?? "AI 回覆沒有可用的空格");

  // Renumber, because a dropped blank would otherwise leave a gap in the passage.
  const kept = new Set(questions.map((question) => question.blank));
  let renumbered = passage;
  let next = 1;
  for (let index = 1; index <= children.length; index += 1) {
    renumbered = kept.has(index)
      ? renumbered.replace(blankToken(index - 1), blankToken(next++ - 1))
      : renumbered.replace(blankToken(index - 1), children[index - 1].answer);
  }
  questions.forEach((question, index) => {
    question.blank = index + 1;
    question.prompt = `Blank ${index + 1}`;
  });

  return {
    dropped,
    payload: {
      kind: "questions",
      questions: [
        {
          difficulty,
          format,
          kind: "reading",
          passage: renumbered,
          questions,
          title,
          wordKeys,
        },
      ],
    },
  };
}

export function assembleGeneratedQuestions(
  value: unknown,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
  words: WordEntry[],
): AssemblyResult {
  if (!isRecord(value)) throw new Error("AI 回覆必須是 JSON object");
  return isPassageKind(kind)
    ? assemblePassage(value, kind, difficulty, words)
    : assembleSentences(value, kind, difficulty, words);
}
