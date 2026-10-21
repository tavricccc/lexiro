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
import { SUPPORTED_PARTS_OF_SPEECH } from "@lexiro/ai-contract";

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
  if (parsed.data.kind !== "questions") throw new Error("Invalid question data");
  const byKey = Object.fromEntries(words.map((word) => [word.wordKey, word]));
  for (const question of parsed.data.questions) {
    if (
      authoring &&
      question.kind === "multipleChoice" &&
      question.questionStyle !== "vocabulary"
    )
      throw new Error(`Question ${question.id}: questionStyle "${question.questionStyle}" is not supported; multiple-choice questions must be vocabulary, use a passage type for others`);
    if (!questionUsesWords(question, byKey))
      throw new Error(
        question.kind === "reading"
          ? `Question ${question.id}: wordKeys not in this set: ${question.wordKeys.filter((key) => !byKey[key]).join(", ") || "(wordKeys do not match the children)"}`
          : `Question ${question.id}: wordKey ${question.wordKey} / senseId ${question.senseId} is not in this set; use wordKey and senses.id from read words`,
      );
    if (
      question.kind === "reading" &&
      question.questions.some(
        (child) =>
          !byKey[child.wordKey]?.senses.some((s) => s.id === child.senseId),
      )
    )
      throw new Error(
        `Question ${question.id}: children ${question.questions
          .filter((child) => !byKey[child.wordKey]?.senses.some((s) => s.id === child.senseId))
          .map((child) => `${child.id} (wordKey ${child.wordKey} / senseId ${child.senseId})`)
          .join(", ")} use senses not in this set`,
      );
  }
  const ids = parsed.data.questions.map((q) => q.id);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (repeated.length || ids.length !== values.length)
    throw new Error(`Duplicate question IDs: ${[...new Set(repeated)].join(", ") || "(the batch repeats a question)"}`);
  return parsed.data.questions;
}
export function validateAgentSnapshot(
  value: unknown,
  setId: string,
): AgentSetSnapshot {
  const parsed = snapshotSchema.parse(value);
  if (parsed.set.id !== setId) throw new Error("Set is outside the authorized scope");
  const words = parsed.words.map((word) => {
    if (word.wordKey !== buildSetWordKey(setId, word.word))
      throw new Error("Word identity does not belong to this set");
    for (const s of word.senses)
      if (s.id !== buildSenseId(word.wordKey as WordKey, s.pos, s.meaningZh))
        throw new Error("Sense ID does not match its content");
    if (new Set(word.senses.map((s) => s.id)).size !== word.senses.length)
      throw new Error("Duplicate sense ID");
    return word as WordEntry;
  });
  if (new Set(words.map((w) => w.wordKey)).size !== words.length)
    throw new Error("Duplicate word ID");
  const byKey = new Map(words.map((w) => [w.wordKey, w]));
  const memberships = parsed.memberships.map((member) => {
    const word = byKey.get(member.wordKey as WordKey);
    if (
      !word ||
      member.senseIds.length !== word.senses.length ||
      new Set(member.senseIds).size !== member.senseIds.length ||
      member.senseIds.some((id) => !word.senses.some((s) => s.id === id))
    )
      throw new Error("Set sources are incomplete");
    return {
      wordKey: member.wordKey as WordKey,
      senseIds: member.senseIds as SenseId[],
    };
  });
  if (
    memberships.length !== words.length ||
    new Set(memberships.map((m) => m.wordKey)).size !== words.length
  )
    throw new Error("Set memberships are incomplete");
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
    throw new Error("Source senses must belong to this set");
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
    action.words.forEach((draft, index) => {
      const at = `words[${index}] "${draft.word}"`;
      const previous = draft.wordKey
        ? next.words.find((w) => w.wordKey === draft.wordKey)
        : next.words.find(
            (w) => normalizeWordKey(w.word) === normalizeWordKey(draft.word),
          );
      if (draft.wordKey && !previous)
        throw new Error(`${at}: wordKey ${draft.wordKey} is not in this set; omit wordKey to add a new word`);
      const wordKey = buildSetWordKey(next.set.id, draft.word);
      if (next.words.some((w) => w.wordKey === wordKey && w !== previous))
        throw new Error(`${at}: the renamed word already exists in this set`);
      const senses = draft.senses.map((s, senseIndex) => {
        const pos = normalizePartOfSpeech(s.pos);
        if (!pos)
          throw new Error(
            `${at}.senses[${senseIndex}].pos "${s.pos}" is not supported; use one of ${SUPPORTED_PARTS_OF_SPEECH.join(" ")} (full names such as noun or verb also work). Write v. for vt./vi.`,
          );
        const id = buildSenseId(wordKey, pos, s.meaningZh);
        if (s.id) {
          if (!previous?.senses.some((old) => old.id === s.id))
            throw new Error(`${at}.senses[${senseIndex}].id ${s.id} is not an existing sense of this word; omit id to add a sense`);
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
      const seen = new Set<string>();
      senses.forEach((sense, senseIndex) => {
        if (seen.has(sense.id))
          throw new Error(`${at}.senses[${senseIndex}] duplicates an earlier sense (same pos ${sense.pos} and meaningZh "${sense.meaningZh}")`);
        seen.add(sense.id);
      });
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
    });
  }
  if (action.type === "delete_words") {
    const unknown = action.wordKeys.filter(
      (key) => !next.words.some((w) => w.wordKey === key),
    );
    if (unknown.length)
      throw new Error(`wordKeys not in this set: ${unknown.join(", ")}; nothing was deleted`);
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
    const unknown = action.questionIds.filter(
      (id) => !next.questions.some((q) => q.id === id),
    );
    if (unknown.length)
      throw new Error(`questionIds not in this set: ${unknown.join(", ")}; nothing was deleted`);
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
      if (blockedQuestionIds.includes(id)) throw new AgentQuestionError("question_outside_scope", "id", "This question ID already belongs to another set.", typeof source.senseId === "string" ? source.senseId : undefined);
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
export { SUPPORTED_PARTS_OF_SPEECH };
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
      ref: s.id,
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
    instructions: `You write and submit the content yourself; the service never calls a model API. Follow the user's request for which words, how many items, length, difficulty, order and explanations. sources are what you may use: you need not use all of them, may write several items for one source, and need not write one item per source. Bind each item to its source with senseId (brief sources set ref = senseId, so either works); never bind by array position. With a single source, senseId may be omitted. Keep the answer in the prose and name the exact span to blank in answer; add usage only when that span occurs more than once. explanation, whyWrong and reading skill/evidence are optional. See outputSchema for the format; JSON key order does not matter. Ordinary multiple-choice items need three distractors; shared option banks have ten options for wordBank and five for discourse. Length outside the recommended range is only a warning; wrong sources, unlocatable answers and invalid options are errors. mode defaults to partial, which saves valid independent items and reports per-item errors; atomic saves nothing if any error occurs. Passage groups are saved or rejected as a whole. validate checks without writing. put_questions can add or edit complete stored questions without a brief. Difficulty, style and similarity are your judgment; follow the user on whether inflected or derived forms share items. Source entries are never removed.`,
    outputSchema: agentQuestionOutputSchema(kind),
  };
}
