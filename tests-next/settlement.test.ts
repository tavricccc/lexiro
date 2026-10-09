import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { testDatabase } from "./database";
import { account, reserve, settle } from "../src/billing";
import { prepareGeneration } from "../src/generation";
import { settleGeneration } from "../src/settlement";
import type { StreamTerminal } from "../src/response-stream";

let mf: Miniflare, db: D1Database;
beforeEach(async () => {
  const fixture = await testDatabase();
  mf = fixture.runtime;
  db = fixture.db;
});
afterEach(async () => {
  await mf.dispose();
});

const senses = (...items: { pos: string; meaningZh: string; example: string }[][]) =>
  JSON.stringify({ items: items.map((entry) => ({ senses: entry })) });

const terminal = (text: string): StreamTerminal => ({
  status: "complete",
  cursor: "resp_test",
  response: {
    id: "resp_test",
    usage: { input_tokens: 900, output_tokens: 60 },
    output: [{ content: [{ type: "output_text", text }] }],
  },
});

const bankOptions = ["is", "child", "are", "were", "adult", "student", "doctor", "open", "arrive", "quiet"];
const bankPassage = "The hall is open. One child waited outside.";
const bankBlanks = [
  { ref: "s2", usage: "One child waited outside", answer: "child" },
  { ref: "s1", usage: "The hall is open", answer: "is" },
].map((item) => ({ ...item, explanation: "依本位置的原文用法判斷。", whyWrong: bankOptions.filter((option) => option !== item.answer).map((option) => ({ option, reason: "此候選不符合本位置的用法。" })) }));
const bankRequest = () => ({
  kind: "wordBank" as const, model: "gpt-6-luna" as const, tier: "lite" as const,
  session: crypto.randomUUID(), difficulty: 2 as const,
  sources: [{ ref: "s1", word: "be", pos: "aux.", meaningZh: "是" }, { ref: "s2", word: "child", pos: "n.", meaningZh: "孩子" }],
});
const bankResult = (refs = ["s2", "s1"]) => ({
  title: "A hall", passage: bankPassage, options: bankOptions,
  blanks: refs.map((ref, index) => ({ ...bankBlanks[index], ref })),
});

/**
 * Settles one supplement run over bank and current.
 *
 * What a refund changes is not this run's debit — that is what the provider
 * actually cost — but whether the word has to be paid for again: a kept unit
 * leaves its charge behind, so reserving it a second time is free.
 */
async function settleSupplement(text: string, limit: 1 | 2 | 3) {
  const session = crypto.randomUUID();
  const request = {
    kind: "senses",
    model: "gpt-6-luna", tier: "lite",
    session,
    limit,
    sources: [
      { ref: "s1", word: "bank", pos: "n.", meaningZh: "銀行" },
      { ref: "s2", word: "current", pos: "adj.", meaningZh: "目前的" },
    ],
  } as const;
  const prepared = await prepareGeneration(request, "u");
  const before = (await account(db, "u"))!.points;
  const reservation = await reserve(db, "u", prepared.units, prepared.halfRate);
  await settleGeneration(
    db,
    reservation,
    prepared,
    terminal(text),
    "gpt-6-luna",
  );
  const after = (await account(db, "u"))!.points;
  const again = await reserve(
    db,
    "u",
    (await prepareGeneration(request, "u")).units,
    prepared.halfRate,
  );
  const payAgain = again.charges.reduce(
    (total, charge) => total + charge.points,
    0,
  );
  // The probe held the account; give every point back and release it.
  await settle(db, again, again.charges, { model: "gpt-6-luna" }, { charged: 0, cost: 0 });
  return { debit: before - after, payAgain };
}

describe("reading retry identity", () => {
  it.each([3, 4, 5])("keeps a completed %i-question article free to retry in the same session", async (count) => {
    const request = {
      kind: "reading", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), difficulty: 2,
      sources: [{ ref: "s1", word: "apple", pos: "n.", meaningZh: "蘋果" }],
    } as const;
    const prepared = await prepareGeneration(request, "u");
    const hold = await reserve(db, "u", prepared.units, prepared.halfRate);
    const result = terminal(JSON.stringify({
      title: "A market visit",
      passage: "Mina bought apples at the market. Her friends had not brought snacks. She shared the apples with them before class.",
      items: [
        {
          question: "What is the passage mainly about?", answer: "Mina shared food with her friends.",
          distractors: ["Mina opened a market.", "Mina prepared a school meal.", "Mina sold apples to classmates."],
          skill: "mainIdea", evidence: ["She shared the apples with them before class."],
        },
        {
          question: "Why might Mina's apples have been useful to her friends?", answer: "Her friends had no snacks of their own.",
          distractors: ["Her friends needed fruit to sell.", "Her friends had brought too much food.", "Her friends were teaching a class."],
          skill: "inference", evidence: ["Her friends had not brought snacks.", "She shared the apples with them before class."],
        },
        {
          question: "What did Mina buy?", answer: "Apples", distractors: ["Bread", "Milk", "Rice"],
          skill: "detail", evidence: ["Mina bought apples at the market."],
        },
        {
          question: "Who does them refer to?", answer: "Mina's friends", distractors: ["The sellers", "The teachers", "Mina's family"],
          skill: "reference", evidence: ["Her friends had not brought snacks.", "She shared the apples with them before class."],
        },
        {
          question: "What does shared mean here?", answer: "Gave some food to others", distractors: ["Sold food for money", "Kept all the food", "Threw the food away"],
          skill: "vocabulary", evidence: ["She shared the apples with them before class."],
        },
      ].slice(0, count).map((item) => ({ ...item, explanation: "依文章線索作答。", whyWrong: item.distractors.map((option) => ({ option, reason: "與文章不符。" })) })),
    }));
    await settleGeneration(db, hold, prepared, result, "gpt-6-luna");
    const balance = (await account(db, "u"))!.points;
    const retry = await reserve(db, "u", prepared.units, prepared.halfRate);
    expect(retry.charges).toEqual([]);
    await settleGeneration(db, retry, prepared, result, "gpt-6-luna");
    expect((await account(db, "u"))!.points).toBe(balance);
    const fresh = await prepareGeneration({ ...request, session: crypto.randomUUID() }, "u");
    expect((await reserve(db, "u", fresh.units, fresh.halfRate)).charges).toHaveLength(1);
  });
});

describe("WordBank source identity settlement", () => {
  it("retains every completed source identity when valid refs are in reverse order", async () => {
    const prepared = await prepareGeneration(bankRequest(), "u");
    const hold = await reserve(db, "u", prepared.units, prepared.halfRate);
    await settleGeneration(db, hold, prepared, terminal(JSON.stringify(bankResult())), "gpt-6-luna");
    const saved = await db.prepare("SELECT id,attempt_id FROM charges WHERE uid='u' ORDER BY id").all<{ id: string; attempt_id: string }>();
    expect(saved.results.map((row) => row.id)).toEqual(prepared.units.map((unit) => unit.id).sort());
    expect(saved.results.every((row) => row.attempt_id === `settled:${hold.attempt}`)).toBe(true);
    const retry = await reserve(db, "u", prepared.units, prepared.halfRate);
    expect(retry.charges).toEqual([]);
    await settle(db, retry, [], { model: "gpt-6-luna" }, { charged: 0, cost: 0 });
  });

  it.each([
    { issue: "missing", refs: ["s2"] },
    { issue: "unknown", refs: ["s2", "s99"] },
    { issue: "duplicate", refs: ["s2", "s2"] },
  ])("does not retain completed identities for $issue source coverage", async ({ refs }) => {
    const prepared = await prepareGeneration(bankRequest(), "u");
    const before = (await account(db, "u"))!.points;
    const hold = await reserve(db, "u", prepared.units, prepared.halfRate);
    const charged = await settleGeneration(db, hold, prepared, terminal(JSON.stringify(bankResult(refs))), "gpt-6-luna");
    expect(charged).toBeGreaterThan(0);
    expect((await db.prepare("SELECT id FROM charges WHERE uid='u'").all()).results).toEqual([]);
    expect(before - (await account(db, "u"))!.points).toBe(charged);
    expect(await db.prepare("SELECT input,output,points,credits,usage_state FROM usage_log WHERE id=?").bind(hold.attempt).first())
      .toMatchObject({ input: 900, output: 60, points: charged, credits: charged, usage_state: "reported" });
    const retry = await reserve(db, "u", prepared.units, prepared.halfRate);
    expect(retry.charges.map((charge) => charge.id).sort()).toEqual(prepared.units.map((unit) => unit.id).sort());
    await settle(db, retry, retry.charges, { model: "gpt-6-luna" }, { charged: 0, cost: 0 });
  });

  it.each([{ ref: "s2", retained: true }, { ref: "s1", retained: false }])("retains a repaired identity only for its original ref ($ref)", async ({ ref, retained }) => {
    const request = { ...bankRequest(), itemRepair: { index: 0, passage: bankPassage, items: bankBlanks } };
    const prepared = await prepareGeneration(request, "u");
    const before = (await account(db, "u"))!.points;
    const hold = await reserve(db, "u", prepared.units, prepared.halfRate);
    const result = terminal(JSON.stringify({ items: [{ ...bankBlanks[0], ref }] }));
    const charged = await settleGeneration(db, hold, prepared, result, "gpt-6-luna");
    const after = (await account(db, "u"))!.points;
    expect(charged).toBeGreaterThan(0);
    expect(before - after).toBe(charged);
    await settleGeneration(db, hold, prepared, result, "gpt-6-luna");
    expect((await account(db, "u"))!.points).toBe(after);
    expect((await db.prepare("SELECT input,output,points,credits,usage_state FROM usage_log WHERE id=?").bind(hold.attempt).all()).results)
      .toEqual([{ input: 900, output: 60, points: charged, credits: charged, usage_state: "reported" }]);
    const retry = await reserve(db, "u", prepared.units, prepared.halfRate);
    expect(retry.charges.map((charge) => charge.id)).toEqual(retained ? [] : [prepared.units[0].id]);
    await settle(db, retry, retry.charges, { model: "gpt-6-luna" }, { charged: 0, cost: 0 });
  });
});

describe("settling a supplement run", () => {
  const river = { pos: "n.", meaningZh: "河岸", example: "We sat on the bank of the river." };
  const flow = { pos: "n.", meaningZh: "水流", example: "The current pulled the boat downstream." };

  it("keeps a word that honestly had nothing to add", async () => {
    const { debit, payAgain } = await settleSupplement(senses([], []), 2);
    expect(debit).toBeGreaterThan(0);
    expect(payAgain).toBe(0);
  });

  it("charges the same whether one meaning came back or two", async () => {
    const one = await settleSupplement(senses([river], []), 2);
    const two = await settleSupplement(senses([river, flow], [flow]), 2);
    expect(one.debit).toBe(two.debit);
    expect(one.payAgain).toBe(0);
    expect(two.payAgain).toBe(0);
  });

  it("does not keep a word that came back with more meanings than were asked for", async () => {
    const { payAgain } = await settleSupplement(senses([river, flow], []), 1);
    expect(payAgain).toBeGreaterThan(0);
  });

  it("does not keep a meaning written in the wrong language", async () => {
    const chinese = { pos: "n.", meaningZh: "河岸", example: "河邊的岸。" };
    const { payAgain } = await settleSupplement(senses([chinese], []), 2);
    expect(payAgain).toBeGreaterThan(0);
  });
});
