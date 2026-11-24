import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Library } from "../src/library/repository";
import { AgentTools } from "../src/agent/mcp";
import { libraryDb } from "./d1";

let runtime: Awaited<ReturnType<typeof libraryDb>>["runtime"];
let db: D1Database;
beforeAll(async () => ({ runtime, db } = await libraryDb()));
afterAll(() => runtime.dispose());

async function agent(words: { word: string; pos: string; meaning: string }[]) {
  const uid = randomUUID(), lib = new Library(db, { unlimited: true });
  const set = await lib.putSet(uid, undefined, { name: "Unit" });
  await lib.putWords(uid, set.id, words.map(({ word, pos, meaning }) => ({ word, senses: [{ pos, meaning }] })));
  const content = await lib.setContent(uid, set.id);
  const senseOf = (word: string) => content.words.find((w) => w.word === word)!.senses[0].id;
  return { tools: new AgentTools(lib, { uid, email: "" }), setId: set.id, senseOf };
}
const read = async (tools: AgentTools, request: object) => ((await tools.read([request as never])) as { results: any[] }).results[0];

describe("question brief", () => {
  it("offers set words with the batch's part of speech first", async () => {
    const { tools, setId, senseOf } = await agent([
      { word: "fragile", pos: "adj.", meaning: "易碎的" },
      { word: "abandon", pos: "v.", meaning: "拋棄" },
      { word: "ambitious", pos: "adj.", meaning: "有抱負的" },
    ]);
    const brief = await read(tools, { resource: "brief", setId, kind: "vocabulary", senseIds: [senseOf("fragile")] });
    expect(brief.setWords.map((w: { word: string }) => w.word)).toEqual(["ambitious", "fragile", "abandon"]);
  });

  it("caps set words at thirty", async () => {
    const words = Array.from({ length: 35 }, (_, i) => ({ word: `word${String(i).padStart(2, "0")}`, pos: "n.", meaning: `意思${i}` }));
    const { tools, setId } = await agent(words);
    const brief = await read(tools, { resource: "brief", setId, kind: "vocabulary" });
    expect(brief.setWords.length).toBe(30);
  });

  it("serves the v27 rules that ask for set-word distractors", async () => {
    const { tools } = await agent([{ word: "fragile", pos: "adj.", meaning: "易碎的" }]);
    const prompt = await read(tools, { resource: "prompt", kind: "vocabulary" });
    expect([prompt.promptVersion, prompt.rules.includes("setWords")]).toEqual(["lexiro-questions-20261117-v27", true]);
  });
});

describe("自由題型 over MCP", () => {
  it("serves the 自由題型 rules with put_questions as the way to write", async () => {
    const { tools } = await agent([{ word: "fragile", pos: "adj.", meaning: "易碎的" }]);
    const prompt = await read(tools, { resource: "prompt", kind: "custom" });
    expect([prompt.kind, prompt.write, prompt.rules.includes("mode")]).toEqual(["custom", "write put_questions", true]);
  });

  it("saves a 自由題型 question and lists its label in the next brief", async () => {
    const { tools, setId, senseOf } = await agent([{ word: "fragile", pos: "adj.", meaning: "易碎的" }]);
    await tools.write(setId, { type: "put_questions", questions: [{ kind: "custom", difficulty: 2, label: "拼字", items: [{ mode: "input", prompt: "易碎的", senseId: senseOf("fragile"), accepted: ["fragile"] }] }] });
    const brief = await read(tools, { resource: "brief", setId, kind: "custom" });
    expect([brief.labels, brief.sources.map((source: { word: string }) => source.word)]).toEqual([["拼字"], ["fragile"]]);
  });

  it("summarizes a 自由題型 question by its label", async () => {
    const { tools, setId, senseOf } = await agent([{ word: "fragile", pos: "adj.", meaning: "易碎的" }]);
    await tools.write(setId, { type: "put_questions", questions: [{ kind: "custom", difficulty: 2, label: "拼字", items: [{ mode: "input", prompt: "易碎的", senseId: senseOf("fragile"), accepted: ["fragile"] }] }] });
    const list = await read(tools, { resource: "questions", setId, kind: "custom" });
    expect(list.items.map((item: { preview: string }) => item.preview)).toEqual(["拼字: 易碎的"]);
  });
});
