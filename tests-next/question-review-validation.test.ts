import { describe, expect, it } from "vitest";
import { prepareGeneration } from "../src/generation";
import { approvedQuestionResult, questionReviewOutput } from "../src/question-review";
import { jsonSchema } from "../src/schemas";
import type { QuestionKind } from "@lexiro/ai-contract";

const whyWrong = (count: number) => Array.from({ length: count }, () => "此選項與題句的明確資訊不符。");
const teaching = { explanation: "依前後文的健康改善結果判斷正解。", whyWrong: whyWrong(3) };
const sentence = "After missing several weeks of school because of a serious illness, Leo followed his doctor's plan and gradually began to recover; soon he could attend classes without feeling weak.";
async function prepared(kind: QuestionKind, count = 1) {
  return prepareGeneration({ kind, difficulty: 2, tier: "lite", model: "gpt-6-luna", session: crypto.randomUUID(),
    sources: Array.from({ length: count }, (_, index) => ({ ref: `s${index + 1}`, word: index ? "cloud" : "recover", pos: "v.", meaningZh: "測試" })) }, "u");
}
const wrapper = (corrected: unknown, count = 1) => ({ approved: true, unresolvedIssues: [], sourceRefs: Array.from({ length: count }, (_, index) => `s${index + 1}`), issues: [], corrected });
const base = { sentence, usage: "recover", answer: "recover", distractors: ["decline", "collapse", "worsen"], ...teaching };
const passage = Array.from({ length: 10 }, (_, index) => `During stage ${index + 1}, the students carefully recorded the water levels beside the bridge and compared their findings with the previous observations before sharing notes each afternoon together.`).join(" ");

describe("reviewed-result admission", () => {
  it("makes approval follow all reasons and rejects any unresolved ambiguity", async () => {
    const schema = jsonSchema(questionReviewOutput("vocabulary"));
    expect(Object.keys(schema.properties as object)).toEqual(["sourceRefs", "issues", "corrected", "unresolvedIssues", "approved"]);
    const config = await prepared("vocabulary");
    expect(() => approvedQuestionResult(config, {...wrapper({items:[base]}), unresolvedIssues:["另一個選項仍有合理讀法。"]})).toThrow(/合理讀法/);
  });
  it.each([
    { ...base, sentence: sentence.replace("recover", "_____") },
    { ...base, usage: "missing" },
    { ...base, sentence: sentence.replace("recover", "recover and recover") },
    { ...base, usage: "to recover" },
    { ...base, distractors: ["decline", "decline", "worsen"] },
  ])("rejects a claimed approval with unusable sentence content", async (item) => {
    const config = await prepared("vocabulary");
    expect(() => approvedQuestionResult(config, wrapper({ items: [item] }))).toThrow();
  });
  it("rejects duplicate shared-bank options and overlapping answer spans", async () => {
    const preparedBank = await prepared("wordBank", 2);
    const preparedCloze = await prepared("cloze", 2);
    const bank = { title: "Observations", passage: `The students took care of the cloud records. ${passage}`,
      blanks: [{ answer: "took care", explanation: "第一格解說。", whyWrong: whyWrong(9) }, { answer: "cloud", explanation: "第二格解說。", whyWrong: whyWrong(9) }],
      extraOptions: ["cloud", "archive", "report", "compare", "measure", "prepare", "recent", "steady"] };
    expect(() => approvedQuestionResult(preparedBank, wrapper(bank, 2))).toThrow(/重複/);
    const cloze = { title: "Observations", passage: `The students took care of the records. ${passage.split(/(?<=\.)\s/).slice(0, 8).join(" ")}`,
      blanks: [{ answer: "took care", distractors: ["watched", "ignored", "forgot"], ...teaching },
        { answer: "care of", distractors: ["look at", "listen to", "wait for"], ...teaching }] };
    expect(() => approvedQuestionResult(preparedCloze, wrapper(cloze, 2))).toThrow(/重疊/);
  });
  it("requires whole, nonadjacent discourse sentences and keeps the opening", async () => {
    const config = await prepared("discourse");
    const sentences = passage.split(/(?<=\.)\s/);
    const make = (indices: number[]) => wrapper({ title: "Observations", passage,
      removals: indices.map((index) => ({ sentence: sentences[index], explanation: "本句接續前後資訊。", whyWrong: whyWrong(4) })),
      extraOption: "The parents moved the exhibition to another town before the project began." });
    expect(() => approvedQuestionResult(config, make([0, 2, 4, 6]))).toThrow(/首句/);
    expect(() => approvedQuestionResult(config, make([1, 2, 5, 7]))).toThrow(/相鄰句/);
  });
  it("rejects evidence split from the same sentence and misaligned source refs", async () => {
    const config = await prepared("reading");
    const first = passage.split(/(?<=\.)\s/)[0];
    const item = { question: "What happened?", answer: "They compared notes.", distractors: ["They stopped work.", "They changed towns.", "They sold records."], ...teaching };
    const reading = wrapper({ title: "Observations", passage, items: [
      { ...item, skill: "mainIdea", evidence: [first] }, { ...item, skill: "detail", evidence: [first] },
      { ...item, skill: "inference", evidence: [first, first.slice(0, 40)] },
    ] });
    expect(() => approvedQuestionResult(config, reading)).toThrow(/不同句子/);
    expect(() => approvedQuestionResult(config, { ...reading, sourceRefs: ["s2"] })).toThrow(/sourceRefs/);
  });
});
