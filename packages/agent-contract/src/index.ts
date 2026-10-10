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
import { questionBatchTask } from "@/src/lib/ai/tasks";
import {
  questionUsesWords,
  questionBelongsToMemberships,
} from "@/src/lib/question-ownership";
import { questionLengthRange } from "@lexiro/ai-contract";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";

export const AGENT_CONTRACT_VERSION = 1 as const;
const text = z.string().trim().min(1).max(10000);
const sense = z.strictObject({
  id: text.optional(),
  pos: text,
  meaningZh: text,
  examples: z.array(text).max(20),
  supplementary: z.boolean().optional(),
});
const wordInput = z.strictObject({
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
    questions: z.array(z.unknown()).min(1).max(30),
  }),
  z.strictObject({
    type: z.literal("delete_questions"),
    questionIds: z.array(text).min(1).max(100),
  }),
  z.strictObject({
    type: z.literal("generated_questions"),
    kind: z.enum(["vocabulary", "cloze", "wordBank", "discourse", "reading"]),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    senseIds: z.array(text).min(1).max(30),
    output: z.unknown(),
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
  });
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
  if (
    words.reduce((n, w) => n + w.senses.length, 0) !== wanted.size ||
    wanted.size !== ids.length
  )
    throw new Error("來源詞義必須完整、唯一且屬於本集");
  return words;
}
export function mutateAgentSet(
  snapshot: AgentSetSnapshot,
  value: unknown,
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
        if (
          !pos ||
          !/[\p{Script=Han}]/u.test(s.meaningZh) ||
          s.examples.some((example) => /\p{Script=Han}/u.test(example))
        )
          throw new Error("詞性、繁體中文詞義或英文例句格式錯誤");
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
  if (action.type === "put_questions") {
    const prepared = action.questions.map((value) => {
      const source = z.record(z.string(), z.unknown()).parse(value);
      const id =
        typeof source.id === "string"
          ? source.id
          : `question-${crypto.randomUUID()}`;
      const old = next.questions.find((q) => q.id === id);
      return {
        ...source,
        id,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
    });
    additions = checkedQuestions(prepared, next.words, true);
  }
  if (action.type === "generated_questions") {
    const task = questionBatchTask(
      selectedWords(next, action.senseIds),
      action.kind,
      action.difficulty,
    );
    additions = task.steps[0].parse(JSON.stringify(action.output));
  }
  for (const q of additions) {
    if (
      next.questions.some(
        (old) => old.id !== q.id && old.fingerprint === q.fingerprint,
      )
    )
      throw new Error("這個題目內容已存在");
    next.questions = [...next.questions.filter((old) => old.id !== q.id), q];
  }
  next.set.updatedAt = now;
  return {
    snapshot: validateAgentSnapshot(next, next.set.id),
    senseRemaps: remaps,
  };
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
  const { min, max } = questionLengthRange(kind, difficulty);
  return {
    kind,
    difficulty,
    sources,
    instructions: `你自己生成內容，再用 generated_questions 提交；不呼叫任何模型 API。英文正文篇幅 ${min}–${max} words。先寫完整正文，再指定 usage（原文唯一定位片段）與 answer（usage 內恰好一次的真正挖空片段），程式負責挖空。詞彙題每個來源一題，輸出 {items:[{sentence,usage,answer,distractors:[三項],explanation,whyWrong:[{option,reason}]}]}。綜合測驗輸出 {title,passage,blanks:[{usage,answer,distractors,explanation,whyWrong}]}。文意選填輸出 {title,passage,options:[十個完整候選],blanks:[{ref,usage,answer,explanation,whyWrong}]}，ref 逐字綁定來源、每來源恰好一次、九個錯項理由。篇章結構輸出 {title,passage,options:[五個完整句],removals:[{sentence,explanation,whyWrong}]}，四個完整且非相鄰刪句、四個錯项理由。閱讀輸出 {title,passage,items:[{skill,evidence:[完整原文句],question,answer,distractors,explanation,whyWrong}]}，3–5 子題，skill 為 detail/mainIdea/inference/vocabulary/reference；推論至少兩個必要事實。題目和例句用自然英文，解說與每個錯項理由用台灣繁體中文。先把所有選項代入實際空格，確認唯一解；理由須依遮答後仍存在的線索。依 sources 順序保留來源，文章題組不可拆成零散小題；勿輸出檢查過程。`,
  };
}
