import { describe, expect, it } from "vitest";
import { countEnglishWords, questionLengthRange } from "@lexiro/ai-contract";
import { questionTask } from "@/src/lib/ai/tasks";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { generatedQuestionQualityIssue } from "@/src/lib/question-quality";
import type { WordEntry } from "@/types";

const source: WordEntry = {
  word: "detect",
  wordKey: normalizeWordKey("detect"),
  updatedAt: "2026-10-02",
  senses: [
    {
      id: asSenseId("detect-sense"),
      pos: "v.",
      meaningZh: "察覺",
      examples: [],
      supplementary: false,
    },
  ],
};
const item = {
  sentence:
    "During the chemistry lesson, a sensor could detect a small gas leak before anyone smelled it, so the teacher immediately opened the windows and led everyone outside.",
  answer: "detect",
  usage: "detect",
  distractors: ["prevent", "repair", "contain"],
  explanation: "感測器先察覺漏氣，才採取後續處理。",
  whyWrong: [
    { option: "prevent", reason: "尚未阻止漏氣。" },
    { option: "repair", reason: "尚未進行修理。" },
    { option: "contain", reason: "沒有圍堵漏氣。" },
  ],
};

describe("high-school generation quality gate", () => {
  it("requires a main idea, a cross-sentence inference and verifiable quoted evidence in reading", () => {
    const first = "The school had only one ladder.";
    const second =
      "Three teams planned to paint different rooms at the same time.";
    const reply = {
      title: "A school project",
      passage: `${first} ${second} ${Array.from({ length: 230 }, () => "context").join(" ")}.`,
      items: [
        {
          question: "What is the main idea?",
          answer: "Planning a school project.",
          distractors: [
            "Buying classroom furniture.",
            "Organizing a sports contest.",
            "Choosing books for a library.",
          ],
          skill: "mainIdea",
          evidence: [first],
        },
        {
          question: "What can be inferred about the teams?",
          answer: "Some teams would need to wait.",
          distractors: [
            "They would cancel the entire project.",
            "They had already completed every room.",
            "They would buy several new buildings.",
          ],
          skill: "inference",
          evidence: [first, second],
        },
        {
          question: "How many teams planned to paint?",
          answer: "Three teams.",
          distractors: ["Two teams.", "Four teams.", "Five teams."],
          skill: "detail",
          evidence: [second],
        },
      ],
    };
    reply.items.forEach((entry) => Object.assign(entry, {
      explanation: "依據文章所述的行動與限制判斷。",
      whyWrong: entry.distractors.map((option, index) => ({ option, reason: ["文章不支持這個選項。", "與文章情境矛盾。", "將可能性誤當成事實。"][index] })),
    }));
    const [step] = questionTask([source], "reading", 2).steps;
    const [pack] = step.parse(JSON.stringify(reply));
    expect(pack.kind === "reading" && pack.questions).toHaveLength(3);
    const broken = { ...reply, items: reply.items.map((entry, index) => index === 1 ? { ...entry, evidence: ["Not in the passage."] } : entry) };
    const recovery = step.recover!(JSON.stringify(broken));
    expect(recovery?.remaining).toHaveLength(1);
    const repairStep = recovery!.remaining[0];
    expect(JSON.parse(repairStep.prompt).itemRepair).toMatchObject({ index: 1, passage: reply.passage });
    expect(repairStep.stagedQuestions).toBe(2);
    const [repaired] = repairStep.parse(JSON.stringify({ items: [reply.items[1]] }));
    expect(repaired.kind === "reading" && repaired.passage).toBe(pack.kind === "reading" && pack.passage);
    expect(repaired.kind === "reading" && repaired.questions).toHaveLength(3);
    const noInference = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        skill: entry.skill === "inference" ? "detail" : entry.skill,
      })),
    };
    expect(() => step.parse(JSON.stringify(noInference))).toThrow(/推論題/);
    const repeatedEvidence = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        evidence: [first, first],
      })),
    };
    expect(() => step.parse(JSON.stringify(repeatedEvidence))).toThrow(
      /兩處不同句子/,
    );
    const inventedEvidence = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        evidence: ["They bought new equipment."],
      })),
    };
    expect(() => step.parse(JSON.stringify(inventedEvidence))).toThrow(
      /逐字引用/,
    );
  });

  it("counts contractions and hyphenated words once without counting blank numbers", () => {
    expect(
      countEnglishWords("The well-known student can't fill __10__ or _____."),
    ).toBe(6);
  });

  it("rejects a short ambiguous stem and missing distractors at the actual task parser", () => {
    const [step] = questionTask([source], "vocabulary", 2).steps;
    expect(() =>
      step.parse(
        JSON.stringify({
          items: [{ ...item, sentence: "They detect leaks." }],
        }),
      ),
    ).toThrow(/24–40/);
    const { distractors: _distractors, ...missing } = item;
    expect(() => step.parse(JSON.stringify({ items: [missing] }))).toThrow(
      /干擾選項/,
    );
    const [question] = step.parse(JSON.stringify({ items: [item] }));
    expect(
      question.kind === "multipleChoice" &&
        question.options[question.answerIndex],
    ).toBe("detect");
  });

  it("checks full passage length even for a final batch with one blank", () => {
    const [step] = questionTask([source], "wordBank", 2).steps;
    const options = ["detect", "repair", "contain", "prevent", "support", "observe", "record", "compare", "measure", "repeat"];
    const reply = {
      title: "A safety project",
      passage: `Students detect ${Array.from({ length: 238 }, () => "signals").join(" ")}.`,
      options,
      blanks: [{ answer: "detect", usage: "detect signals", explanation: "察覺到訊號。", whyWrong: options.slice(1).map((option) => ({ option, reason: "情境未描述這個行動。" })) }],
    };
    const [pack] = step.parse(JSON.stringify(reply));
    expect(pack.kind === "reading" && pack.questions).toHaveLength(1);
    expect(pack.kind === "reading" && pack.optionBank).toHaveLength(10);
    expect(() =>
      step.parse(
        JSON.stringify({ ...reply, passage: "Students detect signals." }),
      ),
    ).toThrow(/240–320/);
  });

  it("keeps explanation ownership despite reason order and repairs only an unrelated option", () => {
    const [step] = questionTask([source], "vocabulary", 2).steps;
    const [question] = step.parse(JSON.stringify({ items: [{ ...item, whyWrong: [...item.whyWrong].reverse() }] }));
    expect(question.kind === "multipleChoice" && question.whyWrong).toMatchObject({
      prevent: "尚未阻止漏氣。", repair: "尚未進行修理。", contain: "沒有圍堵漏氣。",
    });
    expect(() => step.parse(JSON.stringify({ items: [{ ...item, whyWrong: [{ option: "detect", reason: "這是正解。" }, ...item.whyWrong.slice(1)] }] }))).toThrow(/不屬於本題干擾選項/);
    expect(() => step.parse(JSON.stringify({ items: [{ ...item, whyWrong: [item.whyWrong[0], item.whyWrong[0], item.whyWrong[2]] }] }))).toThrow(/解說重複/);
    expect(() => step.parse(JSON.stringify({ items: [{ ...item, explanation: "The sensor notices the leak first." }] }))).toThrow(/必須以中文/);
    expect(() => step.parse(JSON.stringify({ items: [{ ...item, whyWrong: item.whyWrong.map((entry) => ({ ...entry, reason: "This action is not described." })) }] }))).toThrow(/必須以中文/);
  });

  it("repairs shared-bank teaching against the same actual options", () => {
    const [step] = questionTask([source], "wordBank", 2).steps;
    const options = ["detect", "repair", "contain", "prevent", "support", "observe", "record", "compare", "measure", "repeat"];
    const valid = { answer: "detect", usage: "detect signals", explanation: "察覺到訊號。", whyWrong: options.slice(1).map((option) => ({ option, reason: "情境未描述這個行動。" })) };
    const draft = { title: "A safety project", passage: `Students detect ${Array.from({ length: 238 }, () => "signals").join(" ")}.`, options, blanks: [{ ...valid, whyWrong: [{ option: "invented", reason: "不存在的選項。" }, ...valid.whyWrong.slice(1)] }] };
    const recovery = step.recover!(JSON.stringify(draft));
    expect(recovery?.remaining).toHaveLength(1);
    expect(JSON.parse(recovery!.remaining[0].prompt).itemRepair.extraOptions).toEqual(options.slice(1));
    const [pack] = recovery!.remaining[0].parse(JSON.stringify({ items: [valid] }));
    expect(pack.kind === "reading" && pack.optionBank).toHaveLength(10);
    expect(pack.kind === "reading" && pack.questions[0].whyWrong).toHaveProperty("repair", "情境未描述這個行動。");
    expect(step.recover!(JSON.stringify({ ...draft, options: options.slice(1) }))).toBeNull();
    const extraInProse = { ...draft, passage: draft.passage.replace("Students detect", "Students repair tools and detect"), blanks: [valid] };
    expect(generatedQuestionQualityIssue(extraInProse, "wordBank", 2)).toBeNull();
    const [extraPack] = step.parse(JSON.stringify(extraInProse));
    expect(extraPack.kind === "reading" && extraPack.passage).toContain("Students repair tools and __1__ signals");
  });

  it("repairs only the bad cloze teaching when independently anchored blanks share is", () => {
    const roomSource = (word: string): WordEntry => ({ ...source, word, wordKey: normalizeWordKey(word), senses: [{ ...source.senses[0], pos: "phr.", meaningZh: "房間的狀態" }] });
    const ready = { answer: "is", usage: "is ready", ref: "s1", distractors: ["are", "were", "can"], explanation: "第一個房間已準備好。", whyWrong: [{ option: "are", reason: "第一個房間是單數。" }, { option: "were", reason: "沒有說是過去。" }, { option: "can", reason: "後面不是原形動詞。" }] };
    const available = { answer: "is", usage: "is available", ref: "s2", distractors: ["was", "has", "does"], explanation: "第二個房間目前可以使用。", whyWrong: [{ option: "was", reason: "描述目前的狀態。" }, { option: "has", reason: "不是表示擁有。" }, { option: "does", reason: "不是一般動作。" }] };
    const reply = { title: "Rooms", passage: `The first room is ready. ${Array.from({ length: 205 }, () => "context").join(" ")}. Another room is available.`, blanks: [ready, available] };
    const [step] = questionTask([roomSource("be ready"), roomSource("be available")], "cloze", 2).steps;
    const broken = { ...reply, blanks: [ready, { ...available, whyWrong: [{ option: "invented", reason: "不存在的選項。" }, ...available.whyWrong.slice(1)] }] };
    const recovery = step.recover!(JSON.stringify(broken));
    expect(recovery?.remaining).toHaveLength(1);
    expect(recovery!.remaining[0].stagedQuestions).toBe(1);
    expect(JSON.parse(recovery!.remaining[0].prompt).itemRepair.items.map((item: { usage: string }) => item.usage)).toEqual(["is ready", "is available"]);
    const [pack] = recovery!.remaining[0].parse(JSON.stringify({ items: [available] }));
    expect(pack.kind === "reading" && pack.questions[0].whyWrong).toHaveProperty("are", "第一個房間是單數。");
    expect(pack.kind === "reading" && pack.questions[1].whyWrong).toHaveProperty("was", "描述目前的狀態。");
  });

  it("keeps whole, separated discourse sentences and rejects repairs that would change the bank", () => {
    const sentences = Array.from({ length: 12 }, (_, index) => `During stage ${index + 1}, the students carefully recorded every result from their project before comparing the observations with earlier notes and discussing possible explanations together.`);
    const selected = [2, 4, 6, 8].map((index) => sentences[index]);
    const options = [...selected, "The team immediately abandoned the project without collecting any evidence."];
    const draft = { title: "A project", passage: sentences.join(" "), options,
      removals: selected.map((sentence) => ({ sentence, explanation: "上下文描述同一階段的研究步驟。", whyWrong: options.filter((option) => option !== sentence).map((option) => ({ option, reason: "這個選項無法銜接本格前後的階段。" })) })) };
    expect(generatedQuestionQualityIssue(draft, "discourse", 2)).toBeNull();
    const withUnusedSentence = { ...draft, passage: sentences.map((sentence, index) => index === 10 ? options[4] : sentence).join(" ") };
    expect(generatedQuestionQualityIssue(withUnusedSentence, "discourse", 2)).toMatch(/額外誘答選項.*文章/);
    expect(questionTask([source], "discourse", 2).steps[0].recover!(JSON.stringify(withUnusedSentence))).toBeNull();
    const adjacent = { ...draft, removals: draft.removals.map((entry, index) => index === 1 ? { ...entry, sentence: sentences[3] } : entry) };
    expect(generatedQuestionQualityIssue(adjacent, "discourse", 2)).toMatch(/相鄰/);
    expect(questionTask([source], "discourse", 2).steps[0].recover!(JSON.stringify(adjacent))).toBeNull();
    for (const sentence of [sentences[0], sentences[11]])
      expect(generatedQuestionQualityIssue({ ...draft, removals: [{ ...draft.removals[0], sentence }] }, "discourse", 2)).toMatch(/首句或末句/);
    expect(generatedQuestionQualityIssue({ ...draft, removals: [{ ...draft.removals[0], sentence: selected[0].slice(12) }] }, "discourse", 2)).toMatch(/完整原句/);
  });

  it("applies both limits to original passages before cutting whole sentences", () => {
    const range = questionLengthRange("discourse", 3);
    const prose = (count: number) =>
      Array.from({ length: count }, () => "text").join(" ");
    expect(
      generatedQuestionQualityIssue(
        { passage: prose(range.min) },
        "discourse",
        3,
      ),
    ).toBeNull();
    expect(
      generatedQuestionQualityIssue(
        { passage: prose(range.max + 1) },
        "discourse",
        3,
      ),
    ).toMatch(/400/);
  });
});
