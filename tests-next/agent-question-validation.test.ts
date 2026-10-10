import { describe, expect, it } from "vitest";
import { agentSetRevision, createAgentSet, mutateAgentSet, validateAgentGeneratedQuestions } from "@lexiro/agent-contract";
import { normalizeQuestionGenerationJson } from "@/src/lib/question-generation";
const setId = "11111111-1111-4111-8111-111111111111";
function library() {
  return mutateAgentSet(createAgentSet(setId, "合成題庫"), { type: "put_words", words: [
    { word: "rescue", senses: [{ pos: "v.", meaningZh: "救援" }] },
    { word: "adjust", senses: [{ pos: "v.", meaningZh: "調整" }] },
  ] }).snapshot!;
}
describe("Agent question writes", () => {
  it("validates 100 candidates without writes, saves 97, and reports stable IDs for only the 3 errors", () => {
    const snapshot = library(), senseId = snapshot.words[0].senses[0].id;
    const items = Array.from({ length: 100 }, (_, index) => ({ itemId: `candidate-${index}`, senseId,
      sentence: `They rescue stranded hikers during emergency number ${index}.`, answer: "rescue", distractors: ["ignore", "delay", "watch"] }));
    items[17].senseId = "sense-foreign" as typeof senseId;
    items[42].distractors[0] = "rescue";
    items[75].sentence = "They went home before midnight.";
    const input = { kind: "vocabulary" as const, difficulty: 2 as const, output: { items } };
    const before = agentSetRevision(snapshot), dry = validateAgentGeneratedQuestions(snapshot, input);
    expect(dry).toMatchObject({ validCount: 97, failedCount: 3, savedCount: 0, status: "partial_success" });
    expect(agentSetRevision(snapshot)).toBe(before);
    const atomic = mutateAgentSet(snapshot, { type: "generated_questions", ...input, mode: "atomic" });
    expect(atomic.snapshot).toEqual(snapshot);
    expect(atomic.validation).toMatchObject({ validCount: 97, savedCount: 0, status: "rejected" });
    const saved = mutateAgentSet(snapshot, { type: "generated_questions", ...input });
    expect(saved.validation).toMatchObject({ submittedCount: 100, savedCount: 97, failedCount: 3, status: "partial_success" });
    expect(saved.snapshot?.questions).toHaveLength(97);
    expect(saved.validation?.errors.map(e => [e.itemId, e.sourceId, e.code])).toEqual([
      ["candidate-17", "sense-foreign", "unknown_source"],
      ["candidate-42", senseId, "duplicate_options"],
      ["candidate-75", senseId, "answer_not_locatable"],
    ]);
    expect(saved.validation?.warnings).toHaveLength(97);
    expect(saved.validation?.warnings[0]).toMatchObject({ sourceId: senseId, sourceWord: "rescue", severity: "warning", code: "prose_too_short" });
    const retried = mutateAgentSet(saved.snapshot!, { type: "generated_questions", ...input, senseIds: [senseId], output: { items: [items[0]] } });
    expect(retried.snapshot?.questions).toHaveLength(97);
    expect(() => normalizeQuestionGenerationJson(JSON.stringify({ items: [items[0]] }), "vocabulary", 2, [])).toThrow("長度");
  });
  it("binds sources by senseId when reordered, permits subsets, and rejects a mismatched source word", () => {
    const snapshot = library(), rescue = snapshot.words[0].senses[0].id, adjust = snapshot.words[1].senses[0].id;
    const input = { type: "generated_questions", kind: "vocabulary", difficulty: 1, senseIds: [adjust, rescue], output: { items: [
      { senseId: adjust, ref: "s1", sentence: "Please adjust the seat before driving.", answer: "adjust", distractors: ["ignore", "delay", "watch"] },
      { senseId: rescue, sentence: "They rescue stranded hikers before sunset.", answer: "rescue", distractors: ["ignore", "delay", "watch"] },
    ] } };
    const saved = mutateAgentSet(snapshot, input).snapshot!;
    expect(saved.questions.map(q => q.kind === "multipleChoice" && q.senseId)).toEqual([adjust, rescue]);
    const subset = mutateAgentSet(snapshot, { ...input, output: { items: [input.output.items[1]] } });
    expect(subset.snapshot?.questions).toHaveLength(1);
    expect(subset.validation?.unusedSenseIds).toEqual([adjust]);
    const wrong = mutateAgentSet(snapshot, { ...input, output: { items: [{ ...input.output.items[1], senseId: adjust }] } });
    expect(wrong.validation?.errors[0]).toMatchObject({ sourceId: adjust, code: "source_answer_mismatch" });
    expect(wrong.snapshot?.questions).toHaveLength(0);
  });
  it("keeps passage groups complete while allowing partial sources and optional reading audits", () => {
    const snapshot = library(), senseId = snapshot.words[0].senses[0].id;
    const bank = mutateAgentSet(snapshot, { type: "generated_questions", kind: "wordBank", difficulty: 2, output: {
      title: "A rescue", passage: "They rescue the stranded hikers before dinner.", options: ["rescue", "ignore", "delay", "watch", "paint", "cook", "read", "sleep", "write", "sing"],
      blanks: [{ senseId, answer: "rescue" }],
    } });
    expect(bank.validation?.savedCount).toBe(1);
    expect(bank.snapshot?.questions[0]).toMatchObject({ kind: "reading", wordKeys: [snapshot.words[0].wordKey] });
    const reading = mutateAgentSet(snapshot, { type: "generated_questions", kind: "reading", difficulty: 2, output: {
      title: "Hikers", passage: "The hikers waited for help near the old bridge.", items: [{ senseId, question: "Where did they wait?", answer: "Near the bridge", distractors: ["Inside a house", "On a train", "In the city"] }],
    } });
    expect(reading.validation?.savedCount).toBe(1);
    expect(reading.snapshot?.questions[0].kind).toBe("reading");
  });
});
