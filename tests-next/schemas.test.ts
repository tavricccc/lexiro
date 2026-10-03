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
    };
    for (const kind of ["vocabulary"] as const) {
      expect(questionOutput(kind).parse({ items: [item] })).toEqual({ items: [item] });
      const { usage: _unused, ...withoutUsage } = item;
      expect(() => questionOutput(kind).parse({ items: [withoutUsage] })).toThrow();
    }
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
});
