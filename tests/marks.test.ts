import { describe, expect, it } from "vitest";
import type { SetContent } from "@lexiro/contract";
import { isMarked, optionWord, promptWord, wordIndex } from "@/domain/marks";
import type { PracticeItem, Step } from "@/domain/practice";

const step: Step = { prompt: "蘋果", options: ["apple", "pear"], answer: 0, senseId: "s1", wordId: "w1", glosses: ["蘋果", "梨"] };
const meaningStep: Step = { prompt: "apple", options: ["蘋果", "梨"], answer: 0, senseId: "s1", wordId: "w1", glosses: ["apple", "pear"] };

describe("marks", () => {
  it("names the English word behind a Chinese option", () => {
    expect(optionWord(meaningStep, 1)).toBe("pear");
  });
  it("names an English option itself", () => {
    expect(optionWord(step, 1)).toBe("pear");
  });
  it("takes the asked word as a reverse card's word", () => {
    const item = { kind: "reverse", word: "apple", sense: { id: "s1", pos: "n.", meaning: "蘋果", description: "", examples: [], supplementary: false }, steps: [step] } as PracticeItem;
    expect(promptWord(item, step)).toBe("apple");
  });
  it("takes the right answer as a blank's word", () => {
    const item = { kind: "vocabulary", questionId: "q", steps: [{ ...step, prompt: "I ate an _____." }] } as PracticeItem;
    expect(promptWord(item, item.steps[0] as Step)).toBe("apple");
  });
  it("finds set words by spelling regardless of case", () => {
    const content = { set: { id: "a" }, words: [{ id: "w1", word: "Apple", starred: true, senses: [{ meaning: "蘋果" }] }], questions: [] } as unknown as SetContent;
    expect(wordIndex([content]).get("apple")).toMatchObject({ setId: "a", wordId: "w1", starred: true });
  });
  it("matches marks by spelling", () => {
    expect(isMarked(["Pear"], "pear")).toBe(true);
  });
});
