import { describe, expect, it } from "vitest";
import { sourceWordFormIssue } from "@/src/lib/question-word-forms";

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
  it("reads dictionary-style entries: slots, reflexives, alternatives and optional parts", () => {
    for (const [source, pos, answer, usage] of [
      ["in return (for)", "phr.", "in return", "help in return"],
      ["in return (for)", "phr.", "in return for", "in return for help"],
      ["be used to V-ing", "phr.", "is used to", "is used to working"],
      ["get/be used to", "phr.", "got used to", "got used to it"],
      ["a/an", "det.", "an", "an apple"],
      ["by oneself", "phr.", "by herself", "by herself"],
      ["take part (in)", "phr.", "took part", "took part in"],
    ] as const)
      expect(sourceWordFormIssue(source, pos, answer, usage)).toBeNull();
    expect(
      sourceWordFormIssue("get/be used to", "phr.", "got accustomed to", "got accustomed to it"),
    ).not.toBeNull();
    expect(sourceWordFormIssue("by oneself", "phr.", "by chance", "by chance")).not.toBeNull();
    expect(sourceWordFormIssue("mysterious", "adj.", "mysteriously")).not.toBeNull();
  });
});
