import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import {
  applyAnswers,
  checkQuestion,
  compareWords,
  emptyLearning,
  newId,
  normalizeWord,
  prefsInput,
  questionSenseIds,
  type AnswerBatch,
  type CheckedQuestion,
  type DailyGoal,
  type Folder,
  type FolderInput,
  type Issue,
  type Learning,
  type Prefs,
  type Question,
  type Sense,
  type SetInput,
  type SetSummary,
  type Word,
  type WordInput,
  type WordSet,
  folderInput,
  setInput,
  wordInput,
} from "../contract";
import { HttpError, httpError } from "../http";

/**
 * Rows one account may write per UTC day. D1's free write quota is shared by
 * every account; this keeps one account to a small slice of it.
 */
export const DAILY_WRITE_LIMIT = 3000;
export const SET_WORD_LIMIT = 2000;
export const SET_QUESTION_LIMIT = 1000;
const RECEIPT_RETENTION_MS = 30 * 86_400_000;

interface SetRow {
  id: string; folder_id: string | null; name: string; hue: string; icon: string; ord: number | null;
  word_count: number; question_count: number; created_at: string; updated_at: string;
}
interface WordRow { id: string; set_id: string; word: string; starred: number; senses: string; updated_at: string }
interface QuestionRow { id: string; set_id: string; kind: string; difficulty: number; body: string; created_at: string; updated_at: string }

const setValue = (row: SetRow): SetSummary => ({
  id: row.id, name: row.name, folderId: row.folder_id, hue: row.hue as WordSet["hue"], icon: row.icon as WordSet["icon"],
  order: row.ord, createdAt: row.created_at, updatedAt: row.updated_at, wordCount: row.word_count, questionCount: row.question_count,
});
const wordValue = (row: WordRow): Word => ({
  id: row.id, setId: row.set_id, word: row.word, starred: row.starred === 1, senses: JSON.parse(row.senses), updatedAt: row.updated_at,
});
const questionValue = (row: QuestionRow): Question => ({
  ...JSON.parse(row.body), id: row.id, setId: row.set_id, kind: row.kind, difficulty: row.difficulty,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export interface SetContent { set: SetSummary; words: Word[]; questions: Question[] }
export interface QuestionReport {
  saved: string[];
  failed: { index: number; errors: Issue[] }[];
  warnings: { index: number; warnings: Issue[] }[];
}
export interface Backup { version: 1; exportedAt: string; folders: Folder[]; sets: SetContent[]; prefs: Prefs; goal: DailyGoal }

export class Library {
  constructor(readonly db: D1Database, readonly options: { unlimited?: boolean; now?: () => Date } = {}) {}

  /**
   * The account revision just before this instance's first write and just
   * after its last, so a client can tell its own change from someone else's.
   */
  written: { before: number; after: number } | null = null;

  private now() { return (this.options.now?.() ?? new Date()).toISOString(); }

  // ---- account ----------------------------------------------------------

  /** The account row's statements: create it on first use. */
  private ensure(uid: string) {
    return this.db.prepare("INSERT INTO accounts(uid,created_at) VALUES(?,?) ON CONFLICT(uid) DO NOTHING").bind(uid, this.now());
  }

  /**
   * Runs `statements` with the account revision raised and `rows` counted
   * against the daily write limit, all in one transaction.
   */
  private async commit(uid: string, rows: number, statements: D1PreparedStatement[]) {
    const day = this.now().slice(0, 10);
    if (!this.options.unlimited) {
      const quota = await this.db.prepare("SELECT quota_day,quota_writes FROM accounts WHERE uid=?").bind(uid).first<{ quota_day: string; quota_writes: number }>();
      const used = quota?.quota_day === day ? quota.quota_writes : 0;
      if (used + rows > DAILY_WRITE_LIMIT) throw httpError(429, "daily_write_limit", `Daily write limit of ${DAILY_WRITE_LIMIT} rows reached; it resets at 00:00 UTC`);
    }
    const results = await this.db.batch([
      this.ensure(uid),
      this.db.prepare("SELECT revision FROM accounts WHERE uid=?").bind(uid),
      ...statements,
      this.db.prepare(
        "UPDATE accounts SET revision=revision+1, quota_writes=CASE WHEN quota_day=? THEN quota_writes+? ELSE ? END, quota_day=? WHERE uid=? RETURNING revision",
      ).bind(day, rows, rows, day, uid),
    ]);
    const before = (results[1].results[0] as { revision: number } | undefined)?.revision ?? 0;
    const after = (results.at(-1)?.results[0] as { revision: number } | undefined)?.revision ?? before + 1;
    this.written = { before: this.written?.before ?? before, after };
  }

  async revision(uid: string): Promise<number> {
    return (await this.db.prepare("SELECT revision FROM accounts WHERE uid=?").bind(uid).first<number>("revision")) ?? 0;
  }

  /** A stored receipt for this request id, or null when it is new. */
  async receipt<T>(uid: string, id: string): Promise<T | null> {
    const row = await this.db.prepare("SELECT result FROM receipts WHERE uid=? AND id=?").bind(uid, id).first<string>("result");
    return row ? JSON.parse(row) : null;
  }
  private storeReceipt(uid: string, id: string, result: unknown) {
    return this.db.prepare("INSERT OR IGNORE INTO receipts(uid,id,result,created_at) VALUES(?,?,?,?)").bind(uid, id, JSON.stringify(result), this.now());
  }
  async purgeReceipts(now: number) {
    await this.db.prepare("DELETE FROM receipts WHERE created_at<?").bind(new Date(now - RECEIPT_RETENTION_MS).toISOString()).run();
  }

  async prefs(uid: string): Promise<{ prefs: Prefs; goal: DailyGoal }> {
    const row = await this.db.prepare("SELECT prefs,goal FROM accounts WHERE uid=?").bind(uid).first<{ prefs: string; goal: number }>();
    return { prefs: prefsInput.parse(row ? JSON.parse(row.prefs) : {}), goal: (row?.goal ?? 20) as DailyGoal };
  }
  async putPrefs(uid: string, value: unknown): Promise<Prefs> {
    const prefs = prefsInput.parse(value);
    await this.commit(uid, 1, [this.db.prepare("UPDATE accounts SET prefs=? WHERE uid=?").bind(JSON.stringify(prefs), uid)]);
    return prefs;
  }
  async putGoal(uid: string, goal: DailyGoal) {
    await this.commit(uid, 1, [this.db.prepare("UPDATE accounts SET goal=? WHERE uid=?").bind(goal, uid)]);
  }

  // ---- reads ------------------------------------------------------------

  async library(uid: string): Promise<{ revision: number; folders: Folder[]; sets: SetSummary[] }> {
    const [account, folders, sets] = await this.db.batch([
      this.db.prepare("SELECT revision FROM accounts WHERE uid=?").bind(uid),
      this.db.prepare("SELECT id,name,parent_id,ord,updated_at FROM folders WHERE uid=? ORDER BY ord,name").bind(uid),
      this.db.prepare("SELECT * FROM sets WHERE uid=?").bind(uid),
    ]);
    return {
      revision: (account.results[0] as { revision: number } | undefined)?.revision ?? 0,
      folders: (folders.results as { id: string; name: string; parent_id: string | null; ord: number; updated_at: string }[]).map((row) => ({
        id: row.id, name: row.name, parentId: row.parent_id, order: row.ord, updatedAt: row.updated_at,
      })),
      sets: (sets.results as unknown as SetRow[]).map(setValue),
    };
  }

  /** Every starred word across the library, for the starred list and its count. */
  async starred(uid: string): Promise<{ words: Word[] }> {
    const { results } = await this.db.prepare("SELECT id,set_id,word,starred,senses,updated_at FROM words WHERE uid=? AND starred=1").bind(uid).all();
    return { words: (results as unknown as WordRow[]).map(wordValue).sort((a, b) => compareWords(a.word, b.word)) };
  }

  async findSet(uid: string, setId: string): Promise<SetSummary | null> {
    const row = await this.db.prepare("SELECT * FROM sets WHERE uid=? AND id=?").bind(uid, setId).first<SetRow>();
    return row ? setValue(row) : null;
  }
  async requireSet(uid: string, setId: string): Promise<SetSummary> {
    const set = await this.findSet(uid, setId);
    if (!set) throw httpError(404, "set_not_found", `Set ${setId} does not exist`);
    return set;
  }

  async setContent(uid: string, setId: string): Promise<SetContent> {
    const [set, words, questions] = await this.db.batch([
      this.db.prepare("SELECT * FROM sets WHERE uid=? AND id=?").bind(uid, setId),
      this.db.prepare("SELECT id,set_id,word,starred,senses,updated_at FROM words WHERE uid=? AND set_id=?").bind(uid, setId),
      this.db.prepare("SELECT id,set_id,kind,difficulty,body,created_at,updated_at FROM questions WHERE uid=? AND set_id=? ORDER BY created_at,id").bind(uid, setId),
    ]);
    const row = set.results[0] as SetRow | undefined;
    if (!row) throw httpError(404, "set_not_found", `Set ${setId} does not exist`);
    return {
      set: setValue(row),
      words: (words.results as unknown as WordRow[]).map(wordValue).sort((a, b) => compareWords(a.word, b.word)),
      questions: (questions.results as unknown as QuestionRow[]).map(questionValue),
    };
  }

  // ---- folders ----------------------------------------------------------

  async putFolder(uid: string, id: string | undefined, value: FolderInput): Promise<Folder> {
    const input = folderInput.parse(value);
    const folder: Folder = { ...input, id: id ?? newId("folder"), updatedAt: this.now() };
    if (folder.parentId === folder.id) throw httpError(400, "invalid_parent", "A folder cannot contain itself");
    if (folder.parentId && !(await this.db.prepare("SELECT 1 FROM folders WHERE uid=? AND id=?").bind(uid, folder.parentId).first()))
      throw httpError(400, "folder_not_found", `Folder ${folder.parentId} does not exist`);
    await this.commit(uid, 1, [
      this.db.prepare(
        "INSERT INTO folders(uid,id,name,parent_id,ord,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,ord=excluded.ord,updated_at=excluded.updated_at",
      ).bind(uid, folder.id, folder.name, folder.parentId, folder.order, folder.updatedAt),
    ]);
    return folder;
  }

  /** Removes a folder; its sets and subfolders move up to its parent. */
  async deleteFolder(uid: string, id: string) {
    const parent = await this.db.prepare("SELECT parent_id FROM folders WHERE uid=? AND id=?").bind(uid, id).first<{ parent_id: string | null }>();
    if (!parent) return;
    await this.commit(uid, 1, [
      this.db.prepare("UPDATE sets SET folder_id=? WHERE uid=? AND folder_id=?").bind(parent.parent_id, uid, id),
      this.db.prepare("UPDATE folders SET parent_id=? WHERE uid=? AND parent_id=?").bind(parent.parent_id, uid, id),
      this.db.prepare("DELETE FROM folders WHERE uid=? AND id=?").bind(uid, id),
    ]);
  }

  // ---- sets -------------------------------------------------------------

  async putSet(uid: string, id: string | undefined, value: SetInput): Promise<SetSummary> {
    const input = setInput.parse(value);
    const now = this.now();
    const existing = id ? await this.findSet(uid, id) : null;
    if (input.folderId && !(await this.db.prepare("SELECT 1 FROM folders WHERE uid=? AND id=?").bind(uid, input.folderId).first()))
      throw httpError(400, "folder_not_found", `Folder ${input.folderId} does not exist`);
    const set: SetSummary = {
      ...input, id: id ?? newId("set"), createdAt: existing?.createdAt ?? now, updatedAt: now,
      wordCount: existing?.wordCount ?? 0, questionCount: existing?.questionCount ?? 0,
    };
    await this.commit(uid, 1, [
      this.db.prepare(
        "INSERT INTO sets(uid,id,folder_id,name,hue,icon,ord,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET folder_id=excluded.folder_id,name=excluded.name,hue=excluded.hue,icon=excluded.icon,ord=excluded.ord,updated_at=excluded.updated_at",
      ).bind(uid, set.id, set.folderId, set.name, set.hue, set.icon, set.order, set.createdAt, set.updatedAt),
    ]);
    return set;
  }

  /** Places sets in the given order, lowest first. */
  async orderSets(uid: string, ids: string[]) {
    await this.commit(uid, ids.length, ids.map((id, index) => this.db.prepare("UPDATE sets SET ord=? WHERE uid=? AND id=?").bind(index, uid, id)));
  }

  async deleteSet(uid: string, setId: string) {
    await this.commit(uid, 1, [
      this.db.prepare("DELETE FROM question_senses WHERE uid=? AND question_id IN (SELECT id FROM questions WHERE uid=? AND set_id=?)").bind(uid, uid, setId),
      this.db.prepare("DELETE FROM questions WHERE uid=? AND set_id=?").bind(uid, setId),
      this.db.prepare("DELETE FROM words WHERE uid=? AND set_id=?").bind(uid, setId),
      this.db.prepare("DELETE FROM shares WHERE uid=? AND set_id=?").bind(uid, setId),
      this.db.prepare("DELETE FROM sets WHERE uid=? AND id=?").bind(uid, setId),
    ]);
  }

  private recount(uid: string, setId: string) {
    return this.db.prepare(
      "UPDATE sets SET word_count=(SELECT COUNT(*) FROM words WHERE uid=?1 AND set_id=?2), question_count=(SELECT COUNT(*) FROM questions WHERE uid=?1 AND set_id=?2), updated_at=?3 WHERE uid=?1 AND id=?2",
    ).bind(uid, setId, this.now());
  }

  /** Statements removing questions, with their sense index. */
  private dropQuestions(uid: string, ids: string[]) {
    return ids.flatMap((id) => [
      this.db.prepare("DELETE FROM question_senses WHERE uid=? AND question_id=?").bind(uid, id),
      this.db.prepare("DELETE FROM questions WHERE uid=? AND id=?").bind(uid, id),
    ]);
  }

  /** Questions that practise any of these senses; they go when the sense goes. */
  private async questionsUsing(uid: string, senseIds: string[]): Promise<string[]> {
    const rows = await this.selectIn<{ question_id: string }>("SELECT DISTINCT question_id FROM question_senses WHERE uid=? AND sense_id IN", uid, senseIds);
    return [...new Set(rows.map((row) => row.question_id))];
  }

  /** `sql` ending in `IN`, run over `values` in chunks: D1 binds at most 100 parameters. */
  private async selectIn<T>(sql: string, uid: string, values: string[]): Promise<T[]> {
    const rows: T[] = [];
    for (let at = 0; at < values.length; at += 90) {
      const chunk = values.slice(at, at + 90);
      rows.push(...(await this.db.prepare(`${sql} (${chunk.map(() => "?").join(",")})`).bind(uid, ...chunk).all<T>()).results);
    }
    return rows;
  }

  // ---- words ------------------------------------------------------------

  /**
   * Adds or replaces words. A word without an id that spells the same as one
   * in the set merges into it: its new meanings are added. Senses keep their
   * id when edited; removing a sense removes the questions that practise it.
   */
  async putWords(uid: string, setId: string, values: WordInput[]): Promise<{ words: Word[]; removedQuestionIds: string[] }> {
    const content = await this.setContent(uid, setId);
    const byId = new Map(content.words.map((word) => [word.id, word]));
    const byNorm = new Map(content.words.map((word) => [normalizeWord(word.word), word]));
    const now = this.now();
    const written = new Map<string, Word>();
    const removedSenses: string[] = [];
    for (const value of values) {
      const input = wordInput.parse(value);
      const norm = normalizeWord(input.word);
      const previous = input.id ? byId.get(input.id) : byNorm.get(norm);
      if (input.id && !previous) throw httpError(404, "word_not_found", `Word ${input.id} is not in this set`);
      const clash = byNorm.get(norm);
      if (clash && previous && clash.id !== previous.id) throw httpError(409, "duplicate_word", `"${input.word}" is already in this set`);
      const senses: Sense[] = input.senses.map((sense) => ({ ...sense, id: sense.id ?? newId("sense") }));
      if (previous && !input.id) {
        // Same spelling, no id: add the meanings it does not have yet.
        const known = new Set(previous.senses.map((sense) => `${sense.pos}|${sense.meaning}`));
        senses.unshift(...previous.senses);
        for (let index = senses.length - 1; index >= previous.senses.length; index--)
          if (known.has(`${senses[index].pos}|${senses[index].meaning}`)) senses.splice(index, 1);
      } else if (previous) {
        const kept = new Set(senses.map((sense) => sense.id));
        removedSenses.push(...previous.senses.filter((sense) => !kept.has(sense.id)).map((sense) => sense.id));
      }
      if (new Set(senses.map((sense) => sense.id)).size !== senses.length) throw httpError(400, "duplicate_sense", `"${input.word}" repeats a sense id`);
      const word: Word = { id: previous?.id ?? input.id ?? newId("word"), setId, word: input.word, starred: input.starred, senses, updatedAt: now };
      if (previous && previous.word !== word.word) byNorm.delete(normalizeWord(previous.word));
      byId.set(word.id, word);
      byNorm.set(norm, word);
      written.set(word.id, word);
    }
    if (byId.size > SET_WORD_LIMIT) throw httpError(400, "set_word_limit", `A set holds at most ${SET_WORD_LIMIT} words`);
    const removedQuestionIds = await this.questionsUsing(uid, removedSenses);
    await this.commit(uid, written.size + removedQuestionIds.length, [
      ...[...written.values()].map((word) =>
        this.db.prepare(
          "INSERT INTO words(uid,id,set_id,word,norm,starred,senses,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET word=excluded.word,norm=excluded.norm,starred=excluded.starred,senses=excluded.senses,updated_at=excluded.updated_at",
        ).bind(uid, word.id, setId, word.word, normalizeWord(word.word), Number(word.starred), JSON.stringify(word.senses), now),
      ),
      ...this.dropQuestions(uid, removedQuestionIds),
      this.recount(uid, setId),
    ]);
    return { words: [...written.values()], removedQuestionIds };
  }

  async starWords(uid: string, setId: string, ids: string[], starred: boolean) {
    // Touching the set lets other devices see the change from the library index alone.
    await this.commit(uid, ids.length, [
      ...ids.map((id) => this.db.prepare("UPDATE words SET starred=? WHERE uid=? AND set_id=? AND id=?").bind(Number(starred), uid, setId, id)),
      this.db.prepare("UPDATE sets SET updated_at=? WHERE uid=? AND id=?").bind(this.now(), uid, setId),
    ]);
  }

  async deleteWords(uid: string, setId: string, ids: string[]): Promise<{ removedQuestionIds: string[] }> {
    const content = await this.setContent(uid, setId);
    const doomed = content.words.filter((word) => ids.includes(word.id));
    const removedQuestionIds = await this.questionsUsing(uid, doomed.flatMap((word) => word.senses.map((sense) => sense.id)));
    await this.commit(uid, doomed.length + removedQuestionIds.length, [
      ...doomed.map((word) => this.db.prepare("DELETE FROM words WHERE uid=? AND id=?").bind(uid, word.id)),
      ...this.dropQuestions(uid, removedQuestionIds),
      this.recount(uid, setId),
    ]);
    return { removedQuestionIds };
  }

  /** Copies words into another set. Same spellings there gain the missing meanings. */
  async copyWords(uid: string, fromSetId: string, ids: string[], toSetId: string) {
    const source = await this.setContent(uid, fromSetId);
    await this.requireSet(uid, toSetId);
    const words = source.words.filter((word) => ids.includes(word.id));
    return this.putWords(uid, toSetId, words.map((word) => ({
      word: word.word, starred: word.starred,
      senses: word.senses.map(({ id: _id, ...sense }) => sense),
    })));
  }

  // ---- questions --------------------------------------------------------

  /**
   * Checks and saves questions. `partial` saves the valid ones and reports the
   * rest; `atomic` saves nothing unless every one is valid.
   */
  async putQuestions(uid: string, setId: string, values: unknown[], mode: "atomic" | "partial" = "partial"): Promise<QuestionReport> {
    const content = await this.setContent(uid, setId);
    const senses = new Map(content.words.flatMap((word) => word.senses.map((sense) => [sense.id, word.word] as const)));
    const existing = new Map(content.questions.map((question) => [question.id, question]));
    const report: QuestionReport = { saved: [], failed: [], warnings: [] };
    const valid: CheckedQuestion[] = [];
    values.forEach((value, index) => {
      const check = checkQuestion(value, senses);
      if (check.warnings.length) report.warnings.push({ index, warnings: check.warnings });
      if (!check.ok) report.failed.push({ index, errors: check.errors });
      else valid.push(check.question);
    });
    if (mode === "atomic" && report.failed.length) return report;
    const added = valid.filter((question) => !existing.has(question.id)).length;
    if (content.questions.length + added > SET_QUESTION_LIMIT) throw httpError(400, "set_question_limit", `A set holds at most ${SET_QUESTION_LIMIT} questions`);
    if (!valid.length) return report;
    const now = this.now();
    await this.commit(uid, valid.length, [
      ...valid.flatMap((question) => {
        const { id, kind, difficulty, ...body } = question;
        return [
          this.db.prepare("DELETE FROM question_senses WHERE uid=? AND question_id=?").bind(uid, id),
          this.db.prepare(
            "INSERT INTO questions(uid,id,set_id,kind,difficulty,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET kind=excluded.kind,difficulty=excluded.difficulty,body=excluded.body,updated_at=excluded.updated_at",
          ).bind(uid, id, setId, kind, difficulty, JSON.stringify(body), existing.get(id)?.createdAt ?? now, now),
          ...questionSenseIds(question).map((senseId) =>
            this.db.prepare("INSERT OR IGNORE INTO question_senses(uid,question_id,sense_id) VALUES(?,?,?)").bind(uid, id, senseId),
          ),
        ];
      }),
      this.recount(uid, setId),
    ]);
    report.saved = valid.map((question) => question.id);
    return report;
  }

  async deleteQuestions(uid: string, setId: string, ids: string[]) {
    const owned = (await this.setContent(uid, setId)).questions.filter((question) => ids.includes(question.id)).map((question) => question.id);
    await this.commit(uid, owned.length, [...this.dropQuestions(uid, owned), this.recount(uid, setId)]);
    return { deleted: owned };
  }

  // ---- learning ---------------------------------------------------------

  async learning(uid: string): Promise<Learning> {
    const [account, senses, days, tasks] = await this.db.batch([
      this.db.prepare("SELECT goal FROM accounts WHERE uid=?").bind(uid),
      this.db.prepare("SELECT sense_id,word_id,level,answered,correct,last_day FROM learning_senses WHERE uid=?").bind(uid),
      this.db.prepare("SELECT day,answered,correct FROM learning_days WHERE uid=?").bind(uid),
      this.db.prepare("SELECT task,answered,correct FROM learning_tasks WHERE uid=?").bind(uid),
    ]);
    const learning = emptyLearning();
    learning.goal = ((account.results[0] as { goal: number } | undefined)?.goal ?? 20) as DailyGoal;
    for (const row of senses.results as { sense_id: string; word_id: string; level: 0 | 1 | 2 | 3; answered: number; correct: number; last_day: string }[])
      learning.senses[row.sense_id] = { wordId: row.word_id, level: row.level, answered: row.answered, correct: row.correct, lastDay: row.last_day };
    for (const row of days.results as { day: string; answered: number; correct: number }[]) learning.days[row.day] = { answered: row.answered, correct: row.correct };
    for (const row of tasks.results as { task: string; answered: number; correct: number }[]) learning.tasks[row.task] = { answered: row.answered, correct: row.correct };
    return learning;
  }

  /** Applies one queued batch of answers once; a resend changes nothing. */
  async recordAnswers(uid: string, batch: AnswerBatch): Promise<{ applied: boolean }> {
    if (await this.receipt(uid, `answers:${batch.batchId}`)) return { applied: false };
    const senseIds = [...new Set(batch.answers.map((answer) => answer.senseId))];
    const days = [...new Set(batch.answers.map((answer) => answer.day))];
    const tasks = [...new Set(batch.answers.map((answer) => answer.task))];
    const before = emptyLearning();
    for (const row of await this.selectIn<{ sense_id: string; word_id: string; level: 0 | 1 | 2 | 3; answered: number; correct: number; last_day: string }>("SELECT sense_id,word_id,level,answered,correct,last_day FROM learning_senses WHERE uid=? AND sense_id IN", uid, senseIds))
      before.senses[row.sense_id] = { wordId: row.word_id, level: row.level, answered: row.answered, correct: row.correct, lastDay: row.last_day };
    for (const row of await this.selectIn<{ day: string; answered: number; correct: number }>("SELECT day,answered,correct FROM learning_days WHERE uid=? AND day IN", uid, days)) before.days[row.day] = row;
    for (const row of await this.selectIn<{ task: string; answered: number; correct: number }>("SELECT task,answered,correct FROM learning_tasks WHERE uid=? AND task IN", uid, tasks)) before.tasks[row.task] = row;
    const after = applyAnswers(before, batch.answers);
    const statements = [
      ...senseIds.map((id) => {
        const s = after.senses[id];
        return this.db.prepare("INSERT OR REPLACE INTO learning_senses(uid,sense_id,word_id,level,answered,correct,last_day) VALUES(?,?,?,?,?,?,?)").bind(uid, id, s.wordId, s.level, s.answered, s.correct, s.lastDay);
      }),
      ...days.map((day) => this.db.prepare("INSERT OR REPLACE INTO learning_days(uid,day,answered,correct) VALUES(?,?,?,?)").bind(uid, day, after.days[day].answered, after.days[day].correct)),
      ...tasks.map((task) => this.db.prepare("INSERT OR REPLACE INTO learning_tasks(uid,task,answered,correct) VALUES(?,?,?,?)").bind(uid, task, after.tasks[task].answered, after.tasks[task].correct)),
      this.storeReceipt(uid, `answers:${batch.batchId}`, { applied: true }),
    ];
    await this.commit(uid, statements.length, statements);
    return { applied: true };
  }

  // ---- backup -----------------------------------------------------------

  async exportBackup(uid: string): Promise<Backup> {
    const { folders, sets } = await this.library(uid);
    const { prefs, goal } = await this.prefs(uid);
    const contents = [];
    for (const set of sets) contents.push(await this.setContent(uid, set.id));
    return { version: 1, exportedAt: this.now(), folders, sets: contents, prefs, goal };
  }

  /**
   * Adds a backup's folders and sets as new copies; nothing existing is
   * replaced. Questions whose senses did not survive are skipped.
   */
  async importBackup(uid: string, backup: Backup): Promise<{ sets: number; words: number; questions: number }> {
    if (backup?.version !== 1 || !Array.isArray(backup.sets) || !Array.isArray(backup.folders)) throw new HttpError(400, "invalid_backup");
    const folderIds = new Map<string, string>();
    const pending = [...backup.folders];
    // Parents first, so every new folder can point at its new parent.
    while (pending.length) {
      const index = pending.findIndex((folder) => !folder.parentId || folderIds.has(folder.parentId) || !backup.folders.some((f) => f.id === folder.parentId));
      const [folder] = pending.splice(index === -1 ? 0 : index, 1);
      const saved = await this.putFolder(uid, undefined, { name: folder.name, order: folder.order, parentId: folder.parentId ? folderIds.get(folder.parentId) ?? null : null });
      folderIds.set(folder.id, saved.id);
    }
    let words = 0, questions = 0;
    for (const content of backup.sets) {
      const set = await this.putSet(uid, undefined, {
        name: content.set.name, hue: content.set.hue, icon: content.set.icon, order: content.set.order,
        folderId: content.set.folderId ? folderIds.get(content.set.folderId) ?? null : null,
      });
      const senseIds = new Map<string, string>();
      for (let at = 0; at < content.words.length; at += 200) {
        const batch = content.words.slice(at, at + 200);
        const saved = await this.putWords(uid, set.id, batch.map((word) => ({ word: word.word, starred: word.starred, senses: word.senses.map(({ id: _id, ...sense }) => sense) })));
        const byNorm = new Map(saved.words.map((word) => [normalizeWord(word.word), word]));
        for (const old of batch) {
          const now = byNorm.get(normalizeWord(old.word));
          for (const sense of old.senses) {
            const match = now?.senses.find((s) => s.pos === sense.pos && s.meaning === sense.meaning);
            if (match) senseIds.set(sense.id, match.id);
          }
        }
        words += saved.words.length;
      }
      const remapped = content.questions.flatMap((question): unknown[] => {
        const { id: _id, setId: _set, createdAt: _c, updatedAt: _u, ...rest } = question;
        if ("items" in rest) {
          const items = rest.items.map(({ id: _item, ...entry }) => ({ ...entry, senseId: senseIds.get(entry.senseId) ?? "" }));
          return items.every((entry) => entry.senseId) ? [{ ...rest, items }] : [];
        }
        const senseId = senseIds.get(rest.senseId);
        return senseId ? [{ ...rest, senseId }] : [];
      });
      for (let at = 0; at < remapped.length; at += 100)
        questions += (await this.putQuestions(uid, set.id, remapped.slice(at, at + 100))).saved.length;
    }
    return { sets: backup.sets.length, words, questions };
  }

  // ---- sharing ----------------------------------------------------------

  /** The share link of a set; sharing again returns the same link. */
  async share(uid: string, setId: string): Promise<{ id: string }> {
    await this.requireSet(uid, setId);
    const existing = await this.db.prepare("SELECT id FROM shares WHERE uid=? AND set_id=?").bind(uid, setId).first<string>("id");
    if (existing) return { id: existing };
    const id = crypto.randomUUID();
    await this.commit(uid, 1, [this.db.prepare("INSERT INTO shares(id,uid,set_id,created_at) VALUES(?,?,?,?)").bind(id, uid, setId, this.now())]);
    return { id };
  }
  async shareOf(uid: string, setId: string): Promise<string | null> {
    return this.db.prepare("SELECT id FROM shares WHERE uid=? AND set_id=?").bind(uid, setId).first<string>("id");
  }
  async unshare(uid: string, setId: string) {
    await this.commit(uid, 1, [this.db.prepare("DELETE FROM shares WHERE uid=? AND set_id=?").bind(uid, setId)]);
  }
  /** Anyone with the link reads the set's current words and questions. */
  async shared(shareId: string): Promise<SetContent | null> {
    const share = await this.db.prepare("SELECT uid,set_id FROM shares WHERE id=?").bind(shareId).first<{ uid: string; set_id: string }>();
    if (!share) return null;
    try { return await this.setContent(share.uid, share.set_id); }
    catch { return null; }
  }

  // ---- account ----------------------------------------------------------

  async deleteAccount(uid: string) {
    await this.db.batch(["question_senses", "questions", "words", "sets", "folders", "learning_senses", "learning_days", "learning_tasks", "receipts", "shares", "accounts"].map((table) =>
      this.db.prepare(`DELETE FROM ${table} WHERE uid=?`).bind(uid)));
  }
}
