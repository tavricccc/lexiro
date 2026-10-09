import { PASSAGE_FORMATS, questionLengthRange, countEnglishWords, type QuestionKind } from "@lexiro/ai-contract";
import type { PreparedGeneration } from "./generation";

const reject = (reason: string): never => { throw new Error(`question_quality_rejected: ${reason}`); };
const key = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
function hits(prose: string, span: string): number[] {
  const positions: number[] = [];
  let from = 0;
  for (;;) {
    const at = prose.indexOf(span, from);
    if (at < 0 || !span) return positions;
    if (!/[A-Za-z0-9]/.test(prose[at - 1] ?? "") && !/[A-Za-z0-9]/.test(prose[at + span.length] ?? "")) positions.push(at);
    from = at + 1;
  }
}

function anchoredSpan(prose: string, item: Record<string, unknown>) {
  const usage = String(item.usage), answer = String(item.answer);
  const usageAt = hits(prose, usage), answerAt = hits(usage, answer);
  if (usageAt.length !== 1 || answerAt.length !== 1) reject("usage 必須在原文恰好一處，answer 必須在該 usage 內恰好一次");
  const at = usageAt[0] + answerAt[0];
  return { at, end: at + answer.length };
}

/** Shared admission for every reviewed format, before settlement and delivery. */
export function validateReviewedQuestion(prepared: PreparedGeneration, result: Record<string, unknown>) {
  const kind = prepared.request.kind as QuestionKind;
  const list = (result.items ?? result.blanks ?? result.removals) as Record<string, unknown>[];
  const expected = kind === "reading" ? null : kind === "discourse" ? 4 : prepared.request.sources!.length;
  if (expected !== null && list.length !== expected) reject(`題數必須為 ${expected}`);
  if (kind === "reading" && (list.length < 3 || list.length > 5)) reject("閱讀必須有三至五題");
  const range = questionLengthRange(kind, prepared.request.difficulty!);
  const prose = typeof result.passage === "string" ? [result.passage] : list.map((item) => String(item.sentence));
  for (const value of prose) {
    if (/_/u.test(value)) reject("全文不可自行挖空或加入底線");
    const count = countEnglishWords(value);
    if (count < range.min || count > range.max) reject(`全文有 ${count} 詞，必須為 ${range.min}–${range.max} 詞`);
  }
  if (list.some((item) => !/\p{Script=Han}/u.test(String(item.explanation)) || (item.whyWrong as { reason: string }[]).some(({ reason }) => !/\p{Script=Han}/u.test(reason)))) reject("缺少繁體中文逐題解說");
  for (const item of list) {
    const answer = String(kind === "discourse" ? item.sentence : item.answer);
    const options = ["wordBank", "discourse"].includes(kind)
      ? (result.options as string[]).filter((option) => option !== answer)
      : item.distractors as string[];
    const reasons = item.whyWrong as { option: string; reason: string }[];
    const actual = new Set(reasons.map(({ option }) => option));
    if (actual.size !== reasons.length || actual.size !== options.length || options.some((option) => !actual.has(option))) reject("錯項解說必須逐字且完整對應本題候選");
  }
  if (["vocabulary", "cloze", "reading"].includes(kind)) {
    if (list.some((item) => (item.distractors as string[]).length !== 3 || new Set([item.answer, ...(item.distractors as string[])].map((option) => key(String(option)))).size !== 4)) reject("四選項不足或重複");
  }
  if (kind === "vocabulary") {
    for (const item of list) anchoredSpan(String(item.sentence), item);
    return;
  }
  const passage = String(result.passage);
  if (kind === "reading") {
    const skills = new Set(list.map((item) => item.skill));
    if (!skills.has("mainIdea") || skills.size < 2 || (prepared.request.difficulty! >= 2 && !skills.has("inference"))) reject("缺少所需的主旨與推論閱讀任務");
    for (const item of list) {
      const evidence = item.evidence as string[];
      if (!evidence.length || evidence.some((quote) => !quote.trim() || !passage.includes(quote))) reject("evidence 必須從最終 passage 逐字複製");
      if (item.skill !== "inference") continue;
      const positions = [...new Set(evidence)].map((quote) => ({ at: passage.indexOf(quote), end: passage.indexOf(quote) + quote.length })).sort((a, b) => a.at - b.at);
      if (!positions.some((first, index) => positions.slice(index + 1).some((second) => first.end <= second.at && /[.!?](?:\s|$)/.test(passage.slice(first.at, second.at))))) reject("推論需要兩處不重疊且位於不同句子的原文依據");
    }
    return;
  }
  const answers = list.map((item) => String(kind === "discourse" ? item.sentence : item.answer));
  if (kind !== "cloze" && new Set(answers.map(key)).size !== answers.length) reject("空格答案重複");
  const spans = (kind === "cloze" || kind === "wordBank" ? list.map((item) => anchoredSpan(passage, item)) : answers.map((answer) => {
    const at = hits(passage, answer);
    if (at.length !== 1) reject(`答案「${answer}」必須在全文恰好一次`);
    return { at: at[0], end: at[0] + answer.length };
  })).sort((a, b) => a.at - b.at);
  if (spans.some((span, index) => index > 0 && spans[index - 1].end > span.at)) reject("空格答案範圍重疊");
  if (kind === "wordBank" || kind === "discourse") {
    const options = result.options as string[];
    if (options.length !== PASSAGE_FORMATS[kind].optionCount || new Set(options.map(key)).size !== options.length) reject("共用選項不足或重複");
    if (answers.some((answer) => !options.includes(answer))) reject("空格答案不在共用選項");
    if (kind === "discourse") {
      const extras = options.filter((option) => !answers.includes(option));
      if (extras.some((extra) => hits(passage, extra).length)) reject("額外誘答選項不得已存在全文");
    }
  }
  if (kind === "discourse") {
    const sentences = [...passage.matchAll(/[^.!?]+[.!?]+[”"’']*/gu)].map((match) => match[0].trim());
    const indexes = answers.map((answer) => sentences.indexOf(answer)).sort((a, b) => a - b);
    if (indexes.some((index) => index <= 0) || indexes.some((index, position) => position > 0 && indexes[position - 1] + 1 === index)) reject("篇章空格須為完整原句，不得移除首句或相鄰句");
  }
}
