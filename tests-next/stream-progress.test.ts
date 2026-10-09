import { expect, it } from "vitest";
import { createStreamProgress } from "@/src/lib/ai/stream-progress";
const question = { sentence: 'A sentence with "quotes", } and {.', usage: "sentence", answer: "sentence", distractors: ["a", "b", "c"], explanation: "說明", whyWrong: [{ option: "b", reason: "二" }, { option: "c", reason: "三" }, { option: "a", reason: "一" }] };
it("counts complete questions across arbitrary packet boundaries without counting quoted braces", () => {
  const parse = createStreamProgress("vocabulary");
  const first = '{"items":[' + JSON.stringify(question);
  for (let at = 1; at < first.length; at++) expect(parse(first.slice(0, at)).questions).toBe(0);
  expect(parse(first)).toEqual({ units: 1, senses: 0, questions: 1 });
  expect(parse(first + ',' + JSON.stringify(question) + ']}')).toEqual({ units: 2, senses: 0, questions: 2 });
  expect(parse(first + ',' + JSON.stringify(question) + ']}')).toEqual({ units: 2, senses: 0, questions: 2 });
});
it("counts each sense before its enclosing word and ignores unfinished meanings", () => {
  const parse = createStreamProgress("senses");
  const meaning = JSON.stringify({ pos: "n.", meaningZh: "河岸", example: 'The river bank has a sign saying "{welcome}".' });
  const first = '{"items":[{"senses":[' + meaning;
  expect(parse(first.slice(0, -1))).toEqual({ units: 0, senses: 0, questions: 0 });
  expect(parse(first)).toEqual({ units: 0, senses: 1, questions: 0 });
  expect(parse(first + ',' + meaning + ']}]}')).toEqual({ units: 1, senses: 2, questions: 0 });
});
it("counts reading children while the article group is still streaming", () => {
  const parse = createStreamProgress("reading");
  const prefix = '{"title":"Title","passage":"Text","items":[' + JSON.stringify({ ...question, question: "What?", evidence: ["Text"] });
  expect(parse(prefix)).toEqual({ units: 0, senses: 0, questions: 1 });
  expect(parse(prefix + ']}')).toEqual({ units: 1, senses: 0, questions: 1 });
});
