import { describe, expect, it } from "vitest";
import { prepareGeneration } from "../src/generation";
import { approvedQuestionResult, questionReviewOutput } from "../src/question-review";
import { jsonSchema } from "../src/schemas";
import type { QuestionKind } from "@lexiro/ai-contract";

const whyWrong = (options: string[]) => options.map((option) => ({ option, reason: "此選項與題句的明確資訊不符。" }));
const teaching = (options: string[]) => ({ explanation: "依前後文的健康改善結果判斷正解。", whyWrong: whyWrong(options) });
const sentence = "After missing several weeks of school because of a serious illness, Leo followed his doctor's plan and gradually began to recover; soon he could attend classes without feeling weak.";
async function prepared(kind: QuestionKind, count = 1) {
  return prepareGeneration({ kind, difficulty: 2, tier: "lite", model: "gpt-6-luna", session: crypto.randomUUID(),
    sources: Array.from({ length: count }, (_, index) => ({ ref: `s${index + 1}`, word: index ? "cloud" : "recover", pos: "v.", meaningZh: "測試" })) }, "u");
}
const wrapper = (corrected: unknown, count = 1) => ({ approved: true, unresolvedIssues: [], sourceRefs: Array.from({ length: count }, (_, index) => `s${index + 1}`), issues: [], corrected });
const base = { sentence, usage: "recover", answer: "recover", distractors: ["decline", "collapse", "worsen"], ...teaching(["decline", "collapse", "worsen"]) };
const passage = Array.from({ length: 10 }, (_, index) => `During stage ${index + 1}, the students carefully recorded the water levels beside the bridge and compared their findings with the previous observations before sharing notes each afternoon together.`).join(" ");

describe("reviewed-result admission", () => {
  it("makes approval follow all reasons and rejects any unresolved ambiguity", async () => {
    const schema = jsonSchema(questionReviewOutput("vocabulary"));
    expect(Object.keys(schema.properties as object)).toEqual(["sourceRefs", "issues", "corrected", "unresolvedIssues", "approved"]);
    const config = await prepared("vocabulary");
    expect(() => approvedQuestionResult(config, {...wrapper({items:[base]}), unresolvedIssues:["另一個選項仍有合理讀法。"]})).toThrow(/合理讀法/);
  });
  it("rejects nonexistent or duplicated explanation options", async () => {
    const config = await prepared("vocabulary");
    const reasons = whyWrong(["decline", "collapse", "worsen"]);
    expect(() => approvedQuestionResult(config, wrapper({ items: [{ ...base, whyWrong: [{ ...reasons[0], option: "improve" }, ...reasons.slice(1)] }] }))).toThrow(/候選/);
    expect(() => approvedQuestionResult(config, wrapper({ items: [{ ...base, whyWrong: [reasons[0], reasons[0], reasons[2]] }] }))).toThrow(/候選/);
  });
  it.each([
    { ...base, sentence: sentence.replace("recover", "_____") },
    { ...base, usage: "missing" },
    { ...base, sentence: sentence.replace("recover", "recover and recover") },
    { ...base, distractors: ["decline", "decline", "worsen"] },
  ])("rejects a claimed approval with unusable sentence content", async (item) => {
    const config = await prepared("vocabulary");
    expect(() => approvedQuestionResult(config, wrapper({ items: [item] }))).toThrow();
  });
  it("rejects duplicate shared-bank options and overlapping answer spans", async () => {
    const preparedBank = await prepared("wordBank", 2);
    const preparedCloze = await prepared("cloze", 2);
    const options = ["took care", "cloud", "cloud", "archive", "report", "compare", "measure", "prepare", "recent", "steady"];
    const bank = { title: "Observations", passage: `The students took care of the cloud records. ${passage}`, options,
      blanks: [{ ref: "s1", usage: "took care of the cloud records", answer: "took care", explanation: "第一格解說。", whyWrong: whyWrong(options.slice(1)) }, { ref: "s2", usage: "took care of the cloud records", answer: "cloud", explanation: "第二格解說。", whyWrong: whyWrong(options.filter((_, index) => index !== 1)) }] };
    expect(() => approvedQuestionResult(preparedBank, wrapper(bank, 2))).toThrow(/候選|重複/);
    const cloze = { title: "Observations", passage: `The students took care of the records. ${passage.split(/(?<=\.)\s/).slice(0, 8).join(" ")}`,
      blanks: [{ usage: "took care of the records", answer: "took care", distractors: ["watched", "ignored", "forgot"], ...teaching(["watched", "ignored", "forgot"]) },
        { usage: "took care of the records", answer: "care of", distractors: ["look at", "listen to", "wait for"], ...teaching(["look at", "listen to", "wait for"]) }] };
    expect(() => approvedQuestionResult(preparedCloze, wrapper(cloze, 2))).toThrow(/重疊/);
  });
  it("accepts passage-order banks with exact source-ref coverage and rejects misbinding", async () => {
    const config = await prepared("wordBank", 2);
    const options = ["recover", "cloud", "archive", "report", "compare", "measure", "prepare", "recent", "steady", "isolate"];
    const bank = { title: "Observations", passage: `The cloud map helped the students recover their missing records. ${passage}`, options,
      blanks: [{ ref: "s2", usage: "The cloud map", answer: "cloud", ...teaching(options.filter((option) => option !== "cloud")) },
        { ref: "s1", usage: "recover their missing records", answer: "recover", ...teaching(options.filter((option) => option !== "recover")) }] };
    expect(() => approvedQuestionResult(config, wrapper(bank, 2))).not.toThrow();
    for (const ref of ["s2", "s99"]) {
      expect(() => approvedQuestionResult(config, wrapper({ ...bank, blanks: [bank.blanks[0], { ...bank.blanks[1], ref }] }, 2))).toThrow(/ref/);
    }
  });
  it("locates a target inside unique usage while the same word appears elsewhere", async () => {
    const config = await prepared("vocabulary");
    const item = { ...base, sentence: "Today, the exhibition is open to the public, and the entrance is clearly marked. Visitors can leave their coats with the volunteers before entering the hall for the afternoon show.", usage: "the exhibition is open", answer: "is", distractors: ["are", "am", "been"], ...teaching(["are", "am", "been"]) };
    expect(() => approvedQuestionResult(config, wrapper({ items: [item] }))).not.toThrow();
    expect(() => approvedQuestionResult(config, wrapper({ items: [{ ...base, usage: "to recover" }] }))).not.toThrow();
  });
  it("allows equal cloze answers anchored to different contexts", async () => {
    const config = await prepared("cloze", 2);
    const result = { title: "Two rooms", passage: `The hall is reserved today. The classroom is available to members. ${passage.split(/(?<=\.)\s/).slice(0, 8).join(" ")}`, blanks: ["The hall is reserved today", "The classroom is available to members"].map((usage) => ({ usage, answer: "is", distractors: ["are", "am", "been"], ...teaching(["are", "am", "been"]) })) };
    expect(() => approvedQuestionResult(config, wrapper(result, 2))).not.toThrow();
  });
  it("requires whole, nonadjacent discourse sentences and keeps the opening", async () => {
    const config = await prepared("discourse");
    const sentences = passage.split(/(?<=\.)\s/);
    const make = (indices: number[]) => {
      const options = [...indices.map((index) => sentences[index]), "The parents moved the exhibition to another town before the project began."];
      return wrapper({ title: "Observations", passage, options,
        removals: indices.map((index) => ({ sentence: sentences[index], explanation: "本句接續前後資訊。", whyWrong: whyWrong(options.filter((option) => option !== sentences[index])) })) });
    };
    expect(() => approvedQuestionResult(config, make([0, 2, 4, 6]))).toThrow(/首句/);
    expect(() => approvedQuestionResult(config, make([1, 2, 5, 7]))).toThrow(/相鄰句/);
  });
  it("rejects evidence split from the same sentence and misaligned source refs", async () => {
    const config = await prepared("reading");
    const first = passage.split(/(?<=\.)\s/)[0];
    const item = { question: "What happened?", answer: "They compared notes.", distractors: ["They stopped work.", "They changed towns.", "They sold records."], ...teaching(["They stopped work.", "They changed towns.", "They sold records."]) };
    const reading = wrapper({ title: "Observations", passage, items: [
      { ...item, skill: "mainIdea", evidence: [first] }, { ...item, skill: "detail", evidence: [first] },
      { ...item, skill: "inference", evidence: [first, first.slice(0, 40)] },
    ] });
    expect(() => approvedQuestionResult(config, reading)).toThrow(/不同句子/);
    expect(() => approvedQuestionResult(config, { ...reading, sourceRefs: ["s2"] })).toThrow(/sourceRefs/);
  });
});
