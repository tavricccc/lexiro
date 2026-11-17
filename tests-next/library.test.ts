import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Library } from "../src/library/repository";
import { libraryDb, rejection } from "./d1";

let runtime: Awaited<ReturnType<typeof libraryDb>>["runtime"];
let db: D1Database;
beforeAll(async () => ({ runtime, db } = await libraryDb()));
afterAll(() => runtime.dispose());

/** A fresh account in the shared database, so tests do not see each other. */
function account(options: ConstructorParameters<typeof Library>[1] = {}) {
  return { uid: randomUUID(), lib: new Library(db, { unlimited: true, ...options }) };
}
const sense = (meaning: string, pos = "n.") => ({ pos, meaning });
async function setWithWord(lib: Library, uid: string) {
  const set = await lib.putSet(uid, undefined, { name: "Unit 1" });
  const { words } = await lib.putWords(uid, set.id, [{ word: "bank", senses: [sense("銀行"), sense("河岸")] }]);
  return { set, word: words[0] };
}
const vocabulary = (senseId: string, extra: Record<string, unknown> = {}) => ({
  kind: "vocabulary", difficulty: 1, senseId, answer: 0,
  prompt: "She walked along the _____ of the river every morning before school started.",
  options: ["bank", "shore", "coast", "edge"], ...extra,
});

describe("sets and words", () => {
  it("lists a new set with its word count", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    const { sets } = await lib.library(uid);
    expect(sets.map((s) => [s.id, s.name, s.wordCount])).toEqual([[set.id, "Unit 1", 1]]);
  });

  it("returns a set's words A to Z", async () => {
    const { uid, lib } = account();
    const set = await lib.putSet(uid, undefined, { name: "S" });
    await lib.putWords(uid, set.id, ["pear", "Apple", "mango"].map((word) => ({ word, senses: [sense("水果")] })));
    expect((await lib.setContent(uid, set.id)).words.map((w) => w.word)).toEqual(["Apple", "mango", "pear"]);
  });

  it("adds new meanings to a word already spelled the same in the set", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putWords(uid, set.id, [{ word: "Bank", senses: [sense("銀行"), sense("存放", "v.")] }]);
    const [stored] = (await lib.setContent(uid, set.id)).words;
    expect([stored.id, stored.senses.map((s) => s.meaning)]).toEqual([word.id, ["銀行", "河岸", "存放"]]);
  });

  it("refuses to rename a word to a spelling the set already has", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    const { words } = await lib.putWords(uid, set.id, [{ word: "river", senses: [sense("河")] }]);
    const error = await rejection(lib.putWords(uid, set.id, [{ id: words[0].id, word: "bank", senses: [sense("河")] }]));
    expect([error.status, error.code]).toEqual([409, "duplicate_word"]);
  });

  it("keeps a sense's id when its meaning is edited", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putWords(uid, set.id, [{ id: word.id, word: "bank", senses: word.senses.map((s) => ({ ...s, meaning: `${s.meaning}！` })) }]);
    const [stored] = (await lib.setContent(uid, set.id)).words;
    expect(stored.senses.map((s) => s.id)).toEqual(word.senses.map((s) => s.id));
  });

  it("removes the questions of a sense that is removed from its word", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putQuestions(uid, set.id, [vocabulary(word.senses[1].id)]);
    const result = await lib.putWords(uid, set.id, [{ id: word.id, word: "bank", senses: [word.senses[0]] }]);
    expect([result.removedQuestionIds.length, (await lib.setContent(uid, set.id)).questions]).toEqual([1, []]);
  });

  it("removes a deleted word's questions", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putQuestions(uid, set.id, [vocabulary(word.senses[0].id)]);
    await lib.deleteWords(uid, set.id, [word.id]);
    const content = await lib.setContent(uid, set.id);
    expect([content.words, content.questions, content.set.questionCount]).toEqual([[], [], 0]);
  });

  it("copies words into another set, merging a spelling it already has", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    const target = await lib.putSet(uid, undefined, { name: "Target" });
    await lib.putWords(uid, target.id, [{ word: "bank", senses: [sense("河岸")] }]);
    await lib.copyWords(uid, set.id, [word.id], target.id);
    const [copy] = (await lib.setContent(uid, target.id)).words;
    expect(copy.senses.map((s) => s.meaning)).toEqual(["河岸", "銀行"]);
  });

  it("moves a deleted folder's sets to its parent", async () => {
    const { uid, lib } = account();
    const parent = await lib.putFolder(uid, undefined, { name: "School" });
    const child = await lib.putFolder(uid, undefined, { name: "Grade 10", parentId: parent.id });
    const set = await lib.putSet(uid, undefined, { name: "S", folderId: child.id });
    await lib.deleteFolder(uid, child.id);
    expect((await lib.findSet(uid, set.id))?.folderId).toBe(parent.id);
  });

  it("deletes a set with its words, questions and share link", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putQuestions(uid, set.id, [vocabulary(word.senses[0].id)]);
    const { id } = await lib.share(uid, set.id);
    await lib.deleteSet(uid, set.id);
    const left = await db.prepare("SELECT (SELECT COUNT(*) FROM words WHERE uid=?1)+(SELECT COUNT(*) FROM questions WHERE uid=?1) AS n").bind(uid).first<number>("n");
    expect([left, await lib.shared(id)]).toEqual([0, null]);
  });

  it("raises the account revision on every write", async () => {
    const { uid, lib } = account();
    await lib.putSet(uid, undefined, { name: "S" });
    const before = await lib.revision(uid);
    await lib.putPrefs(uid, { practiceSize: 30 });
    expect(await lib.revision(uid)).toBe(before + 1);
  });

  it("stops writes past the daily limit", async () => {
    const uid = randomUUID();
    const lib = new Library(db);
    await db.prepare("INSERT INTO accounts(uid,created_at,quota_day,quota_writes) VALUES(?,?,?,?)").bind(uid, "2026-01-01", new Date().toISOString().slice(0, 10), 3000).run();
    const error = await rejection(lib.putSet(uid, undefined, { name: "S" }));
    expect([error.status, error.code]).toEqual([429, "daily_write_limit"]);
  });
});

describe("questions", () => {
  it("saves the valid questions of a partial batch and reports the rest by field", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    const report = await lib.putQuestions(uid, set.id, [vocabulary(word.senses[0].id), vocabulary(word.senses[0].id, { prompt: "No blank here." })]);
    expect([report.saved.length, report.failed.map((f) => [f.index, f.errors[0].field])]).toEqual([1, [[1, "prompt"]]]);
  });

  it("saves nothing from an atomic batch with an invalid question", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putQuestions(uid, set.id, [vocabulary(word.senses[0].id), vocabulary("sense_missing")], "atomic");
    expect((await lib.setContent(uid, set.id)).questions).toEqual([]);
  });

  it("rejects a question about a sense outside the set", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    const report = await lib.putQuestions(uid, set.id, [vocabulary("sense_elsewhere")]);
    expect(report.failed[0].errors[0].code).toBe("unknown_sense");
  });

  it("stores a cloze passage with its items", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    const options = ["bank", "shore", "coast", "edge"];
    await lib.putQuestions(uid, set.id, [{
      kind: "cloze", difficulty: 1, passage: "We sat on the __1__ and watched the __2__.",
      items: [{ blank: 1, options, answer: 0, senseId: word.senses[1].id }, { blank: 2, options, answer: 1, senseId: word.senses[1].id }],
    }]);
    const [question] = (await lib.setContent(uid, set.id)).questions;
    expect(question.kind === "cloze" && question.items.map((item) => item.blank)).toEqual([1, 2]);
  });
});

describe("learning", () => {
  const batch = (senseId: string, correct: boolean[]) => ({
    batchId: randomUUID(),
    answers: correct.map((value) => ({ senseId, wordId: "w", task: "meaning" as const, correct: value, day: "2026-11-13" })),
  });

  it("counts a resent batch once", async () => {
    const { uid, lib } = account();
    const answers = batch("s1", [true]);
    await lib.recordAnswers(uid, answers);
    await lib.recordAnswers(uid, answers);
    expect((await lib.learning(uid)).days["2026-11-13"]).toEqual({ answered: 1, correct: 1 });
  });

  it("raises familiarity on right answers and lowers it on a wrong one", async () => {
    const { uid, lib } = account();
    await lib.recordAnswers(uid, batch("s1", [true, true, true, false]));
    expect((await lib.learning(uid)).senses.s1.level).toBe(2);
  });
});

describe("sharing and backup", () => {
  it("gives a set the same link when shared twice", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    expect((await lib.share(uid, set.id)).id).toBe((await lib.share(uid, set.id)).id);
  });

  it("lets anyone with the link read the set's words", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    const { id } = await lib.share(uid, set.id);
    expect((await lib.shared(id))?.words.map((w) => w.word)).toEqual(["bank"]);
  });

  it("closes a link once the set is unshared", async () => {
    const { uid, lib } = account();
    const { set } = await setWithWord(lib, uid);
    const { id } = await lib.share(uid, set.id);
    await lib.unshare(uid, set.id);
    expect(await lib.shared(id)).toBeNull();
  });

  it("restores a backup into another account with its questions", async () => {
    const { uid, lib } = account();
    const { set, word } = await setWithWord(lib, uid);
    await lib.putQuestions(uid, set.id, [vocabulary(word.senses[1].id)]);
    const other = randomUUID();
    const counts = await lib.importBackup(other, await lib.exportBackup(uid));
    expect(counts).toEqual({ sets: 1, words: 1, questions: 1 });
  });
});
