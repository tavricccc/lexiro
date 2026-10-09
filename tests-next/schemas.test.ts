import { describe, expect, it } from "vitest";
import type { QuestionKind as GeneratedQuestionKind } from "@lexiro/ai-contract";
import { jsonSchema, questionOutput, wordOutput } from "../src/schemas";

/**
 * Every schema Lexiro sends, in the form it is sent.
 *
 * `strict: true` is on every structured request, and the subset it allows is
 * narrow: each object must list every one of its properties as required and
 * must refuse the ones it did not declare. A property that is merely optional
 * is not a looser contract, it is a rejected request — the whole batch fails
 * with a 400 before a single item is generated, which is what an optional
 * `pos` did.
 */
const KINDS: GeneratedQuestionKind[] = [
  "vocabulary",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
];

function objectsIn(
  node: unknown,
  path: string,
  found: [string, Record<string, unknown>][] = [],
) {
  if (!node || typeof node !== "object") return found;
  const record = node as Record<string, unknown>;
  if (record.type === "object") found.push([path, record]);
  for (const [key, value] of Object.entries(record))
    objectsIn(value, `${path}.${key}`, found);
  return found;
}

describe("structured output schemas", () => {
  const schemas = {
    "words with required examples": jsonSchema(wordOutput({ min: 1, max: 1 })),
    ...Object.fromEntries(
      KINDS.map((kind) => [kind, jsonSchema(questionOutput(kind))]),
    ),
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`states every property of ${name} as required and closed`, () => {
      const objects = objectsIn(schema, name);
      expect(objects.length).toBeGreaterThan(0);
      for (const [path, object] of objects) {
        const properties = Object.keys(object.properties ?? {});
        expect({ path, required: object.required }).toEqual({
          path,
          required: properties,
        });
        expect({ path, closed: object.additionalProperties }).toEqual({
          path,
          closed: false,
        });
      }
    });
  }

  it("requires an exact source usage span for sentence questions", () => {
    const item = {
      sentence: "The report convinced the committee of its safety.",
      usage: "convinced the committee of its safety",
      answer: "convinced",
      distractors: ["informed", "warned", "reminded"],
      explanation: "說明",
      whyWrong: [
        { option: "informed", reason: "一" },
        { option: "warned", reason: "二" },
        { option: "reminded", reason: "三" },
      ],
    };
    for (const kind of ["vocabulary"] as const) {
      expect(questionOutput(kind).parse({ items: [item] })).toEqual({ items: [item] });
      const { usage: _unused, ...withoutUsage } = item;
      expect(() => questionOutput(kind).parse({ items: [withoutUsage] })).toThrow();
      expect(() => questionOutput(kind).parse({ items: [{ ...item, sentence: item.sentence.replace("convinced", "___") }] })).toThrow();
    }
  });

  it("requires explicit option text for every wrong-answer reason", () => {
    const item = {
      sentence: "The report convinced the committee of its safety.",
      usage: "convinced", answer: "convinced", distractors: ["informed", "warned", "reminded"],
      explanation: "說明", whyWrong: ["一", "二", "三"],
    };
    expect(() => questionOutput("vocabulary").parse({ items: [item] })).toThrow();
    const linked = { ...item, whyWrong: item.distractors.map((option) => ({ option, reason: "此選項與題句不符。" })) };
    expect(() => questionOutput("vocabulary").parse({ items: [{ ...linked, distractors: ["展示", "warned", "reminded"] }] })).toThrow();
    expect(() => questionOutput("vocabulary").parse({ items: [{ ...linked, explanation: "This is the correct choice." }] })).toThrow();
    expect(() => questionOutput("wordBank").parse({ title: "A test", passage: "A test passage.", extraOptions: [], blanks: [] })).toThrow();
  });

  it("asks for a part of speech every time, and takes null for one already known", () => {
    const items = wordOutput({ min: 1, max: 1 });
    expect(
      items.parse({
        items: [
          {
            senses: [
              { pos: null, meaningZh: "拒絕", example: "She turned it down." },
            ],
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          senses: [
            { pos: null, meaningZh: "拒絕", example: "She turned it down." },
          ],
        },
      ],
    });
    expect(() => items.parse({ items: [{ meaningZh: "拒絕" }] })).toThrow();
    expect(() =>
      items.parse({ items: [{ pos: null, meaningZh: "拒絕" }] }),
    ).toThrow();
    expect(() => items.parse({ items: [{ senses: [] }] })).toThrow();
    expect(() =>
      items.parse({
        items: [
          {
            senses: [
              { pos: "n.", meaningZh: "銀行", example: "I went to the bank." },
              { pos: "n.", meaningZh: "河岸", example: "We sat by the bank." },
            ],
          },
        ],
      }),
    ).toThrow();
  });
  it.each(["cloze", "wordBank"] as const)("requires an explicit usage anchor in %s rather than accepting the retired raw shape", (kind) => {
    const answer = "is";
    const options = [answer, "are", "am", "been", "was", "were", "be", "has", "have", "being"];
    const item = { usage: "The hall is reserved", answer, ...(kind === "cloze" ? { distractors: options.slice(1, 4) } : {}), explanation: "由此位置的主詞與用法判斷。", whyWrong: options.slice(1, kind === "cloze" ? 4 : 10).map((option) => ({ option, reason: "此形式不符合這個位置的用法。" })) };
    const raw = { title: "A room", passage: "The hall is reserved and the entrance is marked.", ...(kind === "wordBank" ? { options } : {}), blanks: [item] };
    expect(() => questionOutput(kind).parse(raw)).not.toThrow();
    const { usage: _usage, ...retiredItem } = item;
    expect(() => questionOutput(kind).parse({ ...raw, blanks: [retiredItem] })).toThrow();
  });
});
