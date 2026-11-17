import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { checkQuestion } from "../src/contract";
import { Library, type SetContent } from "../src/library/repository";
import { libraryDb, migrate } from "./d1";

const UID = "u1";
const T = "2026-10-01T00:00:00.000Z";
const record = (kind: string, key: string, payload: unknown, seq: number) => [UID, `${kind}:${key}`, kind, key, JSON.stringify(payload), T, seq];
const bank = ["apple", "bank", "cloud", "door", "earth", "field", "garden", "house", "island", "jungle"];
const legacy = [
  record("folder", "f1", { id: "f1", name: "School", order: 0, createdAt: T, updatedAt: T }, 1),
  record("set", "s1", { id: "s1", setName: "Unit 1", folderId: "f1", hue: "sky", createdAt: T, updatedAt: T }, 2),
  record("set", "s2", { id: "s2", setName: "Loose", folderId: "__uncategorized__", createdAt: T, updatedAt: T }, 3),
  record("word", "w1", { wordKey: "w1", word: "bank", updatedAt: T, starred: true, senses: [
    { id: "sa", pos: "n.", meaningZh: "銀行", examples: ["I went to the bank."], supplementary: false },
    { id: "sb", pos: "n.", meaningZh: "河岸", examples: [], supplementary: true, description: "常見 river bank" },
    { id: "sx", pos: "v.", meaningZh: "存錢", examples: [], supplementary: false },
  ] }, 4),
  record("word", "w2", { wordKey: "w2", word: "orphan", updatedAt: T, senses: [{ id: "so", pos: "n.", meaningZh: "孤兒", examples: [], supplementary: false }] }, 5),
  record("question", "q1", { id: "q1", kind: "multipleChoice", questionStyle: "vocabulary", fingerprint: "f", difficulty: 1, createdAt: T, updatedAt: T,
    wordKey: "w1", senseId: "sb", prompt: "We had a picnic on the _____ of the river.", options: ["bank", "shore", "coast", "edge"], answerIndex: 0,
    explanation: "river bank 指河岸。", whyWrong: { shore: "shore 多指海岸。" } }, 6),
  record("question", "q2", { id: "q2", kind: "reading", format: "cloze", fingerprint: "f", difficulty: 1, createdAt: T, updatedAt: T, title: "",
    passage: "We sat on the __1__ all day.", wordKeys: ["w1"],
    questions: [{ id: "c1", kind: "multipleChoice", blank: 1, prompt: "", options: ["bank", "shore", "coast", "edge"], answerIndex: 0, wordKey: "w1", senseId: "sb" }] }, 7),
  record("question", "q3", { id: "q3", kind: "multipleChoice", questionStyle: "grammar", fingerprint: "f", difficulty: 1, createdAt: T, updatedAt: T,
    wordKey: "w1", senseId: "sa", prompt: "He _____ there.", options: ["go", "goes", "went", "gone"], answerIndex: 2 }, 8),
  record("question", "q4", { id: "q4", kind: "multipleChoice", questionStyle: "vocabulary", fingerprint: "f", difficulty: 1, createdAt: T, updatedAt: T,
    wordKey: "w1", senseId: "sx", prompt: "Please _____ the money.", options: ["bank", "eat", "run", "sing"], answerIndex: 0 }, 9),
  record("question", "q5", { id: "q5", kind: "reading", format: "wordBank", fingerprint: "f", difficulty: 1, createdAt: T, updatedAt: T, title: "Trip",
    passage: "The __1__ was closed.", wordKeys: ["w1"], optionBank: bank,
    questions: [{ id: "c1", kind: "multipleChoice", blank: 1, prompt: "", options: bank, answerIndex: 1, wordKey: "w1", senseId: "sa" }] }, 10),
];
const device = (answered: number, level: number, goal: number, goalUpdatedAt: string) => JSON.stringify({
  version: 1, goal, goalUpdatedAt, days: { "2026-10-01": { answered, correct: 1 } }, kinds: { meaning: { answered, correct: 1 } },
  senses: { sa: { answered, correct: 1, wordKey: "w1", level, lastDay: "2026-10-01" } },
});

let runtime: Awaited<ReturnType<typeof libraryDb>>["runtime"];
let db: D1Database;
let content: SetContent;
beforeAll(async () => {
  ({ runtime, db } = await libraryDb({ only: (file) => file < "0009" }));
  await db.batch([
    db.prepare("INSERT INTO cloud_accounts(uid,revision,quota_day,quota_writes) VALUES(?,?,?,?)").bind(UID, 5, "2026-10-01", 10),
    ...legacy.map((row) => db.prepare("INSERT INTO cloud_records(uid,id,kind,record_key,payload,deleted,updated_at,seq) VALUES(?,?,?,?,?,0,?,?)").bind(...row)),
    db.prepare("INSERT INTO cloud_memberships(uid,set_id,word_key,sense_ids) VALUES(?,?,?,?)").bind(UID, "s1", "w1", JSON.stringify(["sa", "sb"])),
    db.prepare("INSERT INTO cloud_learning(uid,device_id,data,updated_at) VALUES(?,?,?,0)").bind(UID, "d1", device(2, 1, 10, "2026-09-01")),
    db.prepare("INSERT INTO cloud_learning(uid,device_id,data,updated_at) VALUES(?,?,?,0)").bind(UID, "d2", device(3, 2, 30, "2026-09-05")),
    db.prepare("INSERT INTO set_shares(id,owner_uid,set_id,created_at) VALUES(?,?,?,?)").bind("11111111-1111-4111-8111-111111111111", UID, "s1", T),
  ]);
  await migrate(db, "library-migrations", (file) => file.startsWith("0009"));
  content = await new Library(db).setContent(UID, "s1");
});
afterAll(() => runtime.dispose());

describe("record conversion", () => {
  it("keeps folders and places sets in them, uncategorized sets at the top level", async () => {
    const { folders, sets } = await new Library(db).library(UID);
    expect([folders.map((f) => f.name), sets.map((s) => [s.name, s.folderId]).sort()]).toEqual([["School"], [["Loose", null], ["Unit 1", "f1"]]]);
  });

  it("moves a word into its set with only the senses its membership lists", () => {
    expect(content.words.map((w) => [w.id, w.starred, w.senses.map((s) => s.meaning)])).toEqual([["w1", true, ["銀行", "河岸"]]]);
  });

  it("keeps a sense's description and supplementary mark", () => {
    expect(content.words[0].senses[1]).toMatchObject({ id: "sb", meaning: "河岸", supplementary: true, description: "常見 river bank" });
  });

  it("drops grammar questions and questions about senses the set lost", () => {
    expect(content.questions.map((q) => q.id).sort()).toEqual(["q1", "q2", "q5"]);
  });

  it("converts every kept question into one that passes the question checks", () => {
    const senses = new Map(content.words.flatMap((w) => w.senses.map((s) => [s.id, w.word] as const)));
    expect(content.questions.map(({ setId: _s, createdAt: _c, updatedAt: _u, ...q }) => [q.id, checkQuestion(q, senses)]).map(([id, check]) => [id, (check as { ok: boolean; errors?: unknown }).errors ?? true])).toEqual([["q1", true], ["q2", true], ["q5", true]]);
  });

  it("gives a shared-bank passage its bank and no per-item options", () => {
    const q5 = content.questions.find((q) => q.id === "q5")!;
    expect(q5.kind === "wordBank" && [q5.bank?.length, q5.items[0].options]).toEqual([10, undefined]);
  });

  it("counts the converted words and questions on the set", () => {
    expect([content.set.wordCount, content.set.questionCount]).toEqual([1, 3]);
  });

  it("sums learning across devices and takes the goal chosen last", async () => {
    const learning = await new Library(db).learning(UID);
    expect([learning.goal, learning.days["2026-10-01"].answered, learning.senses.sa.level, learning.tasks.meaning.answered]).toEqual([30, 5, 2, 5]);
  });

  it("keeps a share link of a converted set", async () => {
    expect((await new Library(db).shared("11111111-1111-4111-8111-111111111111"))?.set.id).toBe("s1");
  });
});
