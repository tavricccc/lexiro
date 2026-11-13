import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Library } from "../src/library/repository";
import { assembleGenerated } from "../src/agent/generation";
import { libraryDb } from "./d1";

let runtime: Awaited<ReturnType<typeof libraryDb>>["runtime"];
let db: D1Database;
beforeAll(async () => ({ runtime, db } = await libraryDb()));
afterAll(() => runtime.dispose());

async function fixture() {
  const uid = randomUUID(), lib = new Library(db, { unlimited: true });
  const set = await lib.putSet(uid, undefined, { name: "Unit" });
  await lib.putWords(uid, set.id, [
    { word: "rescue", senses: [{ pos: "v.", meaning: "救援" }] },
    { word: "estimate", senses: [{ pos: "v.", meaning: "估計" }] },
  ]);
  return { uid, lib, content: await lib.setContent(uid, set.id) };
}
const senseOf = (content: Awaited<ReturnType<typeof fixture>>["content"], word: string) => content.words.find((w) => w.word === word)!.senses[0].id;

describe("generated questions", () => {
  it("turns a generated vocabulary item into a stored question with the blank cut", async () => {
    const { uid, lib, content } = await fixture();
    const { questions } = assembleGenerated(content, {
      kind: "vocabulary", difficulty: 1, mode: "partial",
      output: { items: [{ senseId: senseOf(content, "rescue"), sentence: "The firefighters worked through the night to rescue the family trapped inside the burning house on our street.", answer: "rescue", distractors: ["borrow", "invite", "repair"] }] },
    });
    const report = await lib.putQuestions(uid, content.set.id, questions);
    const [stored] = (await lib.setContent(uid, content.set.id)).questions;
    expect([report.saved.length, stored.kind, "prompt" in stored && stored.prompt.includes("_____")]).toEqual([1, "vocabulary", true]);
  });

  it("reports an answer that is not in the sentence", async () => {
    const { content } = await fixture();
    const { questions, report } = assembleGenerated(content, {
      kind: "vocabulary", difficulty: 1, mode: "partial",
      output: { items: [{ senseId: senseOf(content, "rescue"), sentence: "The team arrived early to help the family.", answer: "rescue", distractors: ["borrow", "invite", "repair"] }] },
    });
    expect([questions.length, report.errors[0]?.code]).toEqual([0, "answer_not_locatable"]);
  });
});
