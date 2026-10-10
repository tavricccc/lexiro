import { z } from "zod";
import type {
  WordEntry,
  WordKey,
  SenseId,
  LibraryQuestion,
  GeneratedQuestionKind,
  QuestionDifficulty,
} from "@/types";
import type { AgentSetSnapshot, AgentMutationResult } from "./public";
import {
  buildSetWordKey,
  buildSenseId,
  normalizePartOfSpeech,
  normalizeWordKey,
  canonicalizeQuestion,
} from "@/src/lib/library";
import { canonicalHash, hashText } from "@/src/lib/hash";
import { parseLibraryImportValue } from "@/src/lib/library-import";
import { agentQuestionOutputSchema, collectAgentGeneratedQuestions } from "./generation";
import { AgentQuestionError, validateQuestionItems } from "./validation";
import type { AgentQuestionReport, AgentQuestionWriteMode } from "./public";
import {
  questionUsesWords,
  questionBelongsToMemberships,
} from "@/src/lib/question-ownership";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";

export const AGENT_CONTRACT_VERSION = 1 as const;
const text = z.string().trim().min(1).max(10000);
const sense = z.object({
  id: text.optional(),
  pos: text,
  meaningZh: text,
  examples: z.array(text).max(20).default([]),
  supplementary: z.boolean().optional(),
});
const wordInput = z.object({
  wordKey: text.optional(),
  word: text.max(200),
  senses: z.array(sense).min(1).max(20),
});
const mutation = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("rename_set"), setName: text.max(200) }),
  z.strictObject({ type: z.literal("move_set"), folderId: text }),
  z.strictObject({
    type: z.literal("put_words"),
    words: z.array(wordInput).min(1).max(200),
  }),
  z.strictObject({
    type: z.literal("delete_words"),
    wordKeys: z.array(text).min(1).max(200),
  }),
  z.strictObject({
    type: z.literal("put_questions"),
    questions: z.array(z.unknown()).min(1).max(200),
    mode: z.enum(["atomic", "partial"]).default("partial"),
  }),
  z.strictObject({
    type: z.literal("delete_questions"),
    questionIds: z.array(text).min(1).max(100),
  }),
  z.strictObject({
    type: z.literal("generated_questions"),
    kind: z.enum(["vocabulary", "cloze", "wordBank", "discourse", "reading"]),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    senseIds: z.array(text).min(1).optional(),
    output: z.unknown(),
    mode: z.enum(["atomic", "partial"]).default("partial"),
  }),
  z.strictObject({ type: z.literal("delete_set") }),
]);
const snapshotSchema = z.strictObject({
  set: z.strictObject({
    id: text,
    setName: text.max(200),
    folderId: text,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  words: z.array(
    z.strictObject({
      wordKey: text,
      word: text.max(200),
      updatedAt: z.iso.datetime(),
      senses: z
        .array(
          z.strictObject({
            id: text,
            pos: text,
            meaningZh: text,
            examples: z.array(text),
            supplementary: z.boolean(),
          }),
        )
        .min(1),
    }),
  ),
  memberships: z.array(
    z.strictObject({ wordKey: text, senseIds: z.array(text).min(1) }),
  ),
  questions: z.array(z.unknown()),
});

export function createAgentSet(
  setId: string,
  setName: string,
  folderId = UNCATEGORIZED_FOLDER_ID,
): AgentSetSnapshot {
  const now = new Date().toISOString();
  return {
    set: {
      id: setId,
      setName: text.max(200).parse(setName),
      folderId,
      createdAt: now,
      updatedAt: now,
    },
    words: [],
    memberships: [],
    questions: [],
  };
}
function checkedQuestions(
  values: unknown[],
  words: WordEntry[],
  authoring = false,
): LibraryQuestion[] {
  const parsed = parseLibraryImportValue({
    kind: "questions",
    schemaVersion: 1,
    questions: values,
  }, { requireEnglish: false });
  if (!parsed.valid) throw new Error(parsed.error);
  if (parsed.data.kind !== "questions") throw new Error("題目資料格式錯誤");
  const byKey = Object.fromEntries(words.map((word) => [word.wordKey, word]));
  for (const question of parsed.data.questions) {
    if (
      authoring &&
      question.kind === "multipleChoice" &&
      question.questionStyle !== "vocabulary"
    )
      throw new Error("只支援學測詞彙及文章題型");
    if (!questionUsesWords(question, byKey))
      throw new Error("題目只能引用這個單字集內的詞義");
    if (
      question.kind === "reading" &&
      question.questions.some(
        (child) =>
          !byKey[child.wordKey]?.senses.some((s) => s.id === child.senseId),
      )
    )
      throw new Error("文章子題只能引用這個單字集內的詞義");
  }
  if (new Set(parsed.data.questions.map((q) => q.id)).size !== values.length)
    throw new Error("題目 ID 不可重複");
  return parsed.data.questions;
}
export function validateAgentSnapshot(
  value: unknown,
  setId: string,
): AgentSetSnapshot {
  const parsed = snapshotSchema.parse(value);
  if (parsed.set.id !== setId) throw new Error("單字集不在授權範圍");
  const words = parsed.words.map((word) => {
    if (word.wordKey !== buildSetWordKey(setId, word.word))
      throw new Error("單字身份不屬於這個單字集");
    for (const s of word.senses)
      if (s.id !== buildSenseId(word.wordKey as WordKey, s.pos, s.meaningZh))
        throw new Error("詞義身份與內容不符");
    if (new Set(word.senses.map((s) => s.id)).size !== word.senses.length)
      throw new Error("詞義 ID 不可重複");
    return word as WordEntry;
  });
  if (new Set(words.map((w) => w.wordKey)).size !== words.length)
    throw new Error("單字 ID 不可重複");
  const byKey = new Map(words.map((w) => [w.wordKey, w]));
  const memberships = parsed.memberships.map((member) => {
    const word = byKey.get(member.wordKey as WordKey);
    if (
      !word ||
      member.senseIds.length !== word.senses.length ||
      new Set(member.senseIds).size !== member.senseIds.length ||
      member.senseIds.some((id) => !word.senses.some((s) => s.id === id))
    )
      throw new Error("單字集來源不完整");
    return {
      wordKey: member.wordKey as WordKey,
      senseIds: member.senseIds as SenseId[],
    };
  });
  if (
    memberships.length !== words.length ||
    new Set(memberships.map((m) => m.wordKey)).size !== words.length
  )
    throw new Error("單字集成員不完整");
  return {
    set: parsed.set,
    words,
    memberships,
    questions: checkedQuestions(parsed.questions, words),
  };
}
export function agentSetRevision(snapshot: AgentSetSnapshot | null) {
  return canonicalHash(
    snapshot && {
      ...snapshot,
      words: [...snapshot.words].sort((a, b) =>
        a.wordKey.localeCompare(b.wordKey),
      ),
      memberships: [...snapshot.memberships].sort((a, b) =>
        a.wordKey.localeCompare(b.wordKey),
      ),
      questions: [...snapshot.questions].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    },
  );
}
export function agentRecordId(kind: string, id: string) {
  return `${kind}-${hashText(id)}`;
}
function selectedWords(snapshot: AgentSetSnapshot, ids: string[]) {
  const wanted = new Set(ids);
  const words = snapshot.words
    .map((word) => ({
      ...word,
      senses: word.senses.filter((s) => wanted.has(s.id)),
    }))
    .filter((w) => w.senses.length);
  if (words.reduce((n, w) => n + w.senses.length, 0) !== wanted.size)
    throw new Error("來源詞義必須屬於本集");
  return words;
}
export function mutateAgentSet(
  snapshot: AgentSetSnapshot,
  value: unknown,
  blockedQuestionIds: string[] = [],
): AgentMutationResult {
  const action = mutation.parse(value);
  if (action.type === "delete_set") return { snapshot: null, senseRemaps: [] };
  const next = structuredClone(snapshot);
  const now = new Date().toISOString();
  const remaps: { from: string; to: string }[] = [];
  if (action.type === "rename_set") next.set.setName = action.setName;
  if (action.type === "move_set") next.set.folderId = action.folderId;
  if (action.type === "put_words") {
    for (const draft of action.words) {
      const previous = draft.wordKey
        ? next.words.find((w) => w.wordKey === draft.wordKey)
        : next.words.find(
            (w) => normalizeWordKey(w.word) === normalizeWordKey(draft.word),
          );
      if (draft.wordKey && !previous) throw new Error("找不到本集要修改的單字");
      const wordKey = buildSetWordKey(next.set.id, draft.word);
      if (next.words.some((w) => w.wordKey === wordKey && w !== previous))
        throw new Error("改名後的單字已存在");
      const senses = draft.senses.map((s) => {
        const pos = normalizePartOfSpeech(s.pos);
        if (!pos) throw new Error("詞性格式錯誤");
        const id = buildSenseId(wordKey, pos, s.meaningZh);
        if (s.id) {
          if (!previous?.senses.some((old) => old.id === s.id))
            throw new Error("只能修改本字既有詞義");
          if (s.id !== id) remaps.push({ from: s.id, to: id });
        }
        return {
          id,
          pos,
          meaningZh: s.meaningZh,
          examples: s.examples,
          supplementary: s.supplementary ?? false,
        };
      });
      if (new Set(senses.map((s) => s.id)).size !== senses.length)
        throw new Error("詞義不可重複");
      const word: WordEntry = {
        wordKey,
        word: draft.word,
        senses,
        updatedAt: now,
      };
      next.words = [...next.words.filter((w) => w !== previous), word];
      if (previous)
        next.questions = next.questions.map((q) => {
          const change = (child: { wordKey: WordKey; senseId: SenseId }) =>
            child.wordKey === previous.wordKey
              ? {
                  ...child,
                  wordKey,
                  senseId: (remaps.find((r) => r.from === child.senseId)?.to ??
                    child.senseId) as SenseId,
                }
              : child;
          return canonicalizeQuestion(
            q.kind === "reading"
              ? {
                  ...q,
                  wordKeys: q.wordKeys.map((key) =>
                    key === previous.wordKey ? wordKey : key,
                  ),
                  questions: q.questions.map(change),
                  updatedAt: now,
                }
              : { ...q, ...change(q), updatedAt: now },
          );
        });
    }
  }
  if (action.type === "delete_words") {
    if (
      action.wordKeys.some((key) => !next.words.some((w) => w.wordKey === key))
    )
      throw new Error("只能刪除本集內的單字");
    next.words = next.words.filter((w) => !action.wordKeys.includes(w.wordKey));
  }
  next.memberships = next.words.map((w) => ({
    wordKey: w.wordKey,
    senseIds: w.senses.map((s) => s.id),
  }));
  next.questions = next.questions.filter(
    (q) =>
      questionUsesWords(
        q,
        Object.fromEntries(next.words.map((w) => [w.wordKey, w])),
      ) && questionBelongsToMemberships(q, next.memberships),
  );
  if (action.type === "delete_questions") {
    if (
      action.questionIds.some((id) => !next.questions.some((q) => q.id === id))
    )
      throw new Error("只能刪除本集內的題目");
    next.questions = next.questions.filter(
      (q) => !action.questionIds.includes(q.id),
    );
  }
  let additions: LibraryQuestion[] = [];
  let validation: AgentQuestionReport | undefined;
  if (action.type === "put_questions") {
    const parsed = validateQuestionItems(next, action.questions, action.mode, [], value => {
      const source = z.record(z.string(), z.unknown()).parse(value);
      const id =
        typeof source.id === "string"
          ? source.id
          : `question-${crypto.randomUUID()}`;
      if (blockedQuestionIds.includes(id)) throw new AgentQuestionError("question_outside_scope", "id", "題目 ID 已屬於其他單字集。", typeof source.senseId === "string" ? source.senseId : undefined);
      const old = next.questions.find((q) => q.id === id);
      return checkedQuestions([{
        ...source,
        id,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      }], next.words, true);
    });
    additions = parsed.questions;
    validation = parsed.report;
  }
  if (action.type === "generated_questions") {
    const parsed = collectAgentGeneratedQuestions(next, action.kind, action.difficulty, action.senseIds, action.output, action.mode);
    additions = parsed.questions;
    validation = parsed.report;
  }
  if (validation && !additions.length) return { snapshot, senseRemaps: [], validation };
  for (const q of additions) {
    const old = next.questions.find(old => old.id === q.id);
    if (old?.fingerprint === q.fingerprint) continue;
    next.questions = [...next.questions.filter((old) => old.id !== q.id), { ...q, createdAt: old?.createdAt ?? q.createdAt }];
  }
  next.set.updatedAt = now;
  return {
    snapshot: validateAgentSnapshot(next, next.set.id),
    senseRemaps: remaps,
    ...(validation ? { validation: { ...validation, savedCount: additions.length } } : {}),
  };
}
export function validateAgentGeneratedQuestions(snapshot: AgentSetSnapshot,
  value: { kind: GeneratedQuestionKind; difficulty: QuestionDifficulty; senseIds?: string[]; output: unknown; mode?: AgentQuestionWriteMode }) {
  return collectAgentGeneratedQuestions(snapshot, value.kind, value.difficulty, value.senseIds, value.output, value.mode ?? "partial").report;
}
export {
  agentFoldersRevision,
  mutateAgentFolders,
  UNCATEGORIZED_FOLDER_ID,
} from "./folders";
export { agentCloudRecord, agentCloudBlob } from "./cloud";
export function agentGenerationBrief(
  snapshot: AgentSetSnapshot,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
  senseIds?: string[],
) {
  const words = selectedWords(
    snapshot,
    senseIds ?? snapshot.words.flatMap((w) => w.senses.map((s) => s.id)),
  );
  const sources = words.flatMap((w) =>
    w.senses.map((s) => ({
      ref: `s${words.slice(0, words.indexOf(w)).reduce((n, v) => n + v.senses.length, 0) + w.senses.indexOf(s) + 1}`,
      word: w.word,
      pos: s.pos,
      meaningZh: s.meaningZh,
      senseId: s.id,
      ...(s.examples[0] ? { knownExample: s.examples[0] } : {}),
    })),
  );
  return {
    kind,
    difficulty,
    sources,
    instructions: `由你自己生成並提交，服務不呼叫模型 API。依使用者要求決定指定單字、題數、篇幅、難度、順序與解說；sources 是可用來源，不必全部使用，也不必每個來源各出一題。每題用 senseId 綁定穩定來源，不以陣列位置綁定；同一來源可以出多題。只有一個來源時可省略 senseId，也可使用本 brief 的 ref。正文保留答案，answer 指定要挖空的原文片段；只有一處時可省略 usage，重複時用 usage 指定位置。explanation、whyWrong、閱讀 skill／evidence 均非寫入必需。格式見 outputSchema，JSON 欄位順序不限。一般選擇題需要三個錯項，共用選項庫依網站格式為文意選填十項、篇章結構五項。篇幅偏離只回傳 warning，不阻擋儲存；來源錯誤、答案無法定位、選項錯誤才是 error。mode 預設 partial，可先儲存有效獨立題目並取得逐題錯誤；atomic 則有任何 error 就不儲存。文章題組保持完整，以整組為一單位。validate_generated_questions 可先唯讀驗證。也可直接用 put_questions 新增或編輯完整題目，無須先取得本 brief。題目難度、風格、語意相似度由你自行判斷，依使用者要求決定是否合併屈折／衍生詞的出題；原始詞條全部保留。`,
    outputSchema: agentQuestionOutputSchema(kind),
  };
}
