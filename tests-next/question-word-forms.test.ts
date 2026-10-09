import { describe, expect, it } from "vitest";
import { sourceWordFormIssue } from "@/src/lib/question-word-forms";
import {
  buildWordGenerationSources,
  parseWordGenerationJson,
  parseSupplementaryJson,
} from "@/src/lib/word-generation";
import { itemToWordEntry } from "@/src/lib/library";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";

describe("source word forms", () => {
  it("keeps all be forms and same-spelling conversion regardless of the taught POS", () => {
    for (const answer of ["am", "is", "are", "was", "were", "been", "being"])
      expect(sourceWordFormIssue("be", "aux.", answer)).toBeNull();
    for (const [source, pos, answer] of [
      ["witness", "n.", "witness"],
      ["witness", "n.", "a witness"],
      ["plot", "n.", "plots"],
      ["rescue", "n.", "rescued"],
      ["clean", "adj.", "cleaned"],
      ["close", "adj.", "closing"],
      ["run", "v.", "running"],
      ["child", "n.", "children's"],
      ["café", "n.", "cafés"],
      ["reliable", "adj.", "more reliable"],
      ["reliable", "adj.", "most reliable"],
    ])
      expect(sourceWordFormIssue(source, pos, answer)).toBeNull();
  });

  it("accepts standard irregular and UK/US forms missed by reverse NLP", () => {
    for (const [source, answer] of [
      ["lie", "lay"],
      ["can", "could"],
      ["may", "might"],
      ["shall", "should"],
      ["will", "would"],
      ["lie", "lain"],
      ["dwell", "dwelt"],
      ["wake", "woke"],
      ["bear", "borne"],
      ["bid", "bidden"],
      ["shrink", "shrunken"],
      ["focus", "focussed"],
      ["panic", "panicked"],
      ["panic", "panicking"],
      ["organize", "organised"],
      ["organise", "organizing"],
      ["colour", "colored"],
      ["travel", "travelled"],
      ["learn", "learnt"],
    ])
      expect(sourceWordFormIssue(source, "v.", answer)).toBeNull();
  });

  it("keeps derivations and replacement synonyms as separate sources", () => {
    for (const [source, answer] of [
      ["rescue", "rescuer"],
      ["rescue", "rescuers"],
      ["decide", "decision"],
      ["mechanic", "mechanical"],
      ["contamination", "contaminated"],
      ["wander", "sprinted"],
      ["panic", "hoping"],
    ])
      expect(sourceWordFormIssue(source, "v.", answer)).not.toBeNull();
    expect(
      sourceWordFormIssue("turn off", "phr. v.", "switched off"),
    ).not.toBeNull();
  });

  it("checks only the supplied phrase usage while permitting inflection and insertions", () => {
    for (const [source, answer, usage] of [
      ["turn off", "turned", "turned the light off"],
      ["take off", "took", "took his coat off"],
      ["look forward to", "looking", "looking eagerly forward to the holiday"],
      ["get used to", "got", "got slowly used to the schedule"],
      ["made up of", "made", "made entirely up of glass"],
      ["put up with", "put", "put quietly up with the noise"],
      ["convince sb of sth", "convinced", "convinced her that it was safe"],
    ])
      expect(sourceWordFormIssue(source, "phr.", answer, usage)).toBeNull();
    expect(
      sourceWordFormIssue("turn off", "phr.", "turned", "turned the light on"),
    ).not.toBeNull();
    expect(
      sourceWordFormIssue("take off", "phr.", "took", "took his coat"),
    ).not.toBeNull();
    // A word-bank head has no named usage: it validates the source form only.
    expect(sourceWordFormIssue("take off", "phr.", "took")).toBeNull();
  });

  it("keeps phrase keys and usages through words, supplementary senses and the library", () => {
    const sources = buildWordGenerationSources(
      "turn off phr. v. 關閉\nbe made up of phr. 由某物組成",
    );
    const drafts = parseWordGenerationJson(
      JSON.stringify({
        items: [
          {
            senses: [
              {
                pos: null,
                meaningZh: "關閉",
                example: "She turned the light off.",
              },
            ],
          },
          {
            senses: [
              {
                pos: null,
                meaningZh: "由某物組成",
                example: "The bottle is made up of glass.",
              },
            ],
          },
        ],
      }),
      sources,
    );
    expect(drafts.map((draft) => draft.word)).toEqual([
      "be made up of",
      "turn off",
    ]);
    const words = drafts.map((draft) => itemToWordEntry(draft));
    const supplemented = parseSupplementaryJson(
      JSON.stringify({
        items: [
          {
            senses: [
              {
                pos: "phr. v.",
                meaningZh: "使人失去興趣",
                example: "His remarks turned the listeners off.",
              },
            ],
          },
        ],
      }),
      [{ word: "turn off", existing: [{ pos: "phr. v.", meaningZh: "關閉" }] }],
      1,
    );
    expect(supplemented[0].word).toBe("turn off");
    expect(supplemented[0].senses[0].examples).toEqual([
      "His remarks turned the listeners off.",
    ]);
    const result = assembleGeneratedQuestions(
      {
        items: [
          {
            answer: "made",
            usage: "is made up of glass",
            sentence: "The bottle is made up of glass.",
            distractors: ["called", "taken", "seen"],
          },
          {
            answer: "turned",
            usage: "turned the light off",
            sentence: "She turned the light off.",
            distractors: ["pulled", "took", "pushed"],
          },
        ],
      },
      "vocabulary",
      2,
      words,
    );
    expect(result.dropped).toEqual([]);
    expect(result.payload.questions).toHaveLength(2);
  });
});
