import { z } from "zod";
import type { GeneratedQuestionKind, QuestionDifficulty, WordEntry } from "@/types";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";
import { getQuestionSourceRefs } from "@/src/lib/question-generation";
import { parseLibraryImportValue } from "@/src/lib/library-import";
import { canonicalizeQuestion } from "@/src/lib/library";
import { canonicalHash } from "@/src/lib/hash";
import { isRecord } from "@/src/lib/schema";
import { sourceWordFormIssue } from "@/src/lib/question-word-forms";
import { locateUsageAnswer } from "@/src/lib/question-spans";
import { countEnglishWords, questionLengthRange } from "@lexiro/ai-contract";
import { AgentQuestionError, validateQuestionItems } from "./validation";
import type { AgentQuestionWriteMode, AgentSetSnapshot } from "./public";

const text = z.string().trim().min(1);
const teaching = {
  explanation: z.string().optional(),
  whyWrong: z.union([
    z.array(z.object({ option: text, reason: text })),
    z.record(z.string(), z.string()),
  ]).optional(),
};
const source = {
  senseId: text.optional().describe("Stable senseId of this item's source, copied exactly. Sources may be used in any order and more than once."),
  ref: text.optional().describe("Same value as senseId (brief sources set ref = senseId); give either one. Optional when there is only one source."),
};
const blank = {
  ...source,
  usage: text.optional().describe("A passage snippet locating the answer when it occurs more than once; optional when it occurs once."),
  answer: text,
  ...teaching,
};
const choices = { distractors: z.array(text).length(3) };

/** Storage shape only: editorial choices belong to the user and Agent. */
function outputShape(kind: GeneratedQuestionKind) {
  const article = { title: text, passage: text };
  const schema = kind === "vocabulary"
    ? z.object({ items: z.array(z.object({ ...blank, sentence: text, ...choices })).min(1).max(200) })
    : kind === "reading"
      ? z.object({ ...article, items: z.array(z.object({ ...source, question: text, answer: text, ...choices, ...teaching })).min(1) })
      : kind === "discourse"
        ? z.object({ ...article, options: z.array(text).length(5), unusedReason: z.string().optional().describe("Why the unused sentence fits no gap. Each removal needs only its explanation, not per-option reasons."), removals: z.array(z.object({ ...source, sentence: text, ...teaching })).min(1) })
        : kind === "wordBank"
          ? z.object({ ...article, options: z.array(text).length(10), optionMeanings: z.array(z.object({ option: text, meaning: text })).optional().describe("Short Traditional Chinese meaning of every shared option, written once per set. Each blank needs only its explanation, not per-option reasons."), blanks: z.array(z.object(blank)).min(1) })
          : z.object({ ...article, blanks: z.array(z.object({ ...blank, ...choices })).min(1) });
  return schema;
}

export function agentQuestionOutputSchema(kind: GeneratedQuestionKind) { return z.toJSONSchema(outputShape(kind)); }

export function parseAgentGeneratedQuestions(
  output: unknown, kind: GeneratedQuestionKind, difficulty: QuestionDifficulty, words: WordEntry[], itemId?: string,
) {
  const assembled = assembleGeneratedQuestions(output, kind, difficulty, words, "agent");
  if (assembled.dropped.length) throw new Error(assembled.dropped.join("；"));
  const parsed = parseLibraryImportValue(assembled.payload, {
    questionSources: getQuestionSourceRefs(words),
    allowedDifficulty: difficulty,
    requireEnglish: false,
  });
  if (!parsed.valid) throw new Error(parsed.error);
  if (parsed.data.kind !== "questions") throw new Error("題目資料格式錯誤");
  return parsed.data.questions.map(question => {
    const normalized = canonicalizeQuestion(question.kind === "reading"
      ? { ...question, wordKeys: [...new Set(question.questions.map(q => q.wordKey))] } : question);
    return { ...normalized, id: `question-${canonicalHash(itemId
      ? { itemId, sourceIds: normalized.kind === "reading" ? normalized.questions.map(q => q.senseId) : [normalized.senseId] }
      : normalized.fingerprint)}` };
  });
}

export function collectAgentGeneratedQuestions(
  snapshot: AgentSetSnapshot, kind: GeneratedQuestionKind, difficulty: QuestionDifficulty,
  senseIds: string[] | undefined, output: unknown, mode: AgentQuestionWriteMode,
) {
  const requested = senseIds ? new Set(senseIds) : undefined;
  const words = snapshot.words.map(word => ({ ...word, senses: word.senses.filter(s => !requested || requested.has(s.id)) })).filter(w => w.senses.length);
  const slots = words.flatMap(word => word.senses.map(sense => ({ word, sense })));
  const byId = new Map(slots.map(slot => [slot.sense.id as string, slot]));
  const resolve = (raw: Record<string, unknown>) => {
    const senseId = typeof raw.senseId === "string" ? raw.senseId : undefined;
    const ref = typeof raw.ref === "string" ? raw.ref : undefined;
    if (senseId && ref && senseId !== ref)
      throw new AgentQuestionError("source_ref_conflict", "ref", "ref 與 senseId 指向不同來源；ref 就是 senseId，只填其一即可。", senseId);
    if (!senseId && ref && !byId.has(ref))
      throw new AgentQuestionError("unknown_source", "ref", `來源 ${ref} 不存在於本集或本次指定來源。ref 須照抄 brief 來源的 ref（即 senseId），不是位置編號。`, ref);
    const id = senseId ?? ref ?? (slots.length === 1 ? slots[0].sense.id : undefined);
    if (!id) throw new AgentQuestionError("missing_source", "senseId", "請提供本題的 senseId；只有單一來源時可省略。");
    const slot = byId.get(id);
    if (!slot) throw new AgentQuestionError("unknown_source", "senseId", `來源 ${id} 不存在於本集或本次指定來源。`, id);
    return slot;
  };
  const rawItems = kind === "vocabulary" && isRecord(output) && Array.isArray(output.items) ? output.items : [output];
  const items = rawItems.map(item => {
    if (!isRecord(item) || item.senseId !== undefined) return item;
    const slot = typeof item.ref === "string" ? byId.get(item.ref) : slots.length === 1 ? slots[0] : undefined;
    return slot ? { ...item, senseId: slot.sense.id } : item;
  });
  const parse = (value: unknown) => {
    const candidate = kind === "vocabulary" ? { items: [value] } : value;
    const shaped = outputShape(kind).parse(candidate);
    const data = shaped as Record<string, unknown>;
    const field = kind === "cloze" || kind === "wordBank" ? "blanks" : kind === "discourse" ? "removals" : "items";
    const entries = data[field] as Record<string, unknown>[];
    data[field] = entries.map(raw => {
      const slot = resolve(raw);
      const answer = kind === "discourse" ? String(raw.sentence) : String(raw.answer);
      if (kind === "vocabulary" || kind === "cloze" || kind === "wordBank") {
        const prose = kind === "vocabulary" ? String(raw.sentence) : String(data.passage);
        const usage = typeof raw.usage === "string" ? raw.usage : answer;
        const location = locateUsageAnswer(prose, usage, answer);
        if ("issue" in location) throw new AgentQuestionError("answer_not_locatable", "usage", location.issue, slot.sense.id);
        if (kind !== "cloze") {
          const issue = sourceWordFormIssue(slot.word.word, slot.sense.pos, answer, usage);
          if (issue) {
            const other = slots.find(o => o.word !== slot.word && !sourceWordFormIssue(o.word.word, o.sense.pos, answer, usage));
            throw new AgentQuestionError("source_answer_mismatch", "answer",
              other ? `${issue} 答案是本集「${other.word.word}」的詞形，可能填錯來源；請確認 senseId（${other.sense.id}）。` : issue, slot.sense.id);
          }
        }
      }
      if (Array.isArray(raw.distractors)) {
        const options = [answer, ...raw.distractors as string[]].map(option => option.trim().toLocaleLowerCase());
        const repeated = [...new Set(options.filter((option, index) => options.indexOf(option) !== index))];
        if (repeated.length) throw new AgentQuestionError("duplicate_options", "distractors", `選項重複：${repeated.join("、")}（正解「${answer}」也算一個選項）；請換成不同的錯項。`, slot.sense.id);
      }
      return { ...raw, ref: `s${slots.indexOf(slot) + 1}` };
    });
    return parseAgentGeneratedQuestions(data, kind, difficulty, words, isRecord(value) && typeof value.itemId === "string" ? value.itemId : undefined);
  };
  const range = questionLengthRange(kind, difficulty);
  return validateQuestionItems(snapshot, items, mode, senseIds ?? [], parse, value => {
    const prose = isRecord(value) ? kind === "vocabulary" ? value.sentence : value.passage : undefined;
    if (typeof prose !== "string") return [];
    const actual = countEnglishWords(prose);
    return actual < range.min || actual > range.max ? [{ severity: "warning", code: actual < range.min ? "prose_too_short" : "prose_too_long",
      field: kind === "vocabulary" ? "sentence" : "passage", message: `篇幅 ${actual} 字；一般建議 ${range.min}–${range.max} 字，仍可依使用者要求儲存。`,
      actual, recommendedMin: range.min, recommendedMax: range.max }] : [];
  });
}
