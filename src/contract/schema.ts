import { z } from "zod";
import { QUESTION_KINDS } from "./formats";
import { normalizePos } from "./words";

const id = z.string().trim().min(1).max(80);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

export const SET_HUES = ["rose", "amber", "mint", "sky", "violet"] as const;
export const SET_ICONS = ["books", "graduation-cap", "briefcase", "bookmark-simple", "airplane-tilt", "newspaper"] as const;
export type SetHue = (typeof SET_HUES)[number];
export type SetIcon = (typeof SET_ICONS)[number];

export const folderInput = z.strictObject({
  name: text(80),
  parentId: id.nullable().default(null),
  order: z.number().finite().default(0),
});
export type FolderInput = z.input<typeof folderInput>;
export interface Folder extends z.output<typeof folderInput> {
  id: string;
  updatedAt: string;
}

export const setInput = z.strictObject({
  name: text(200),
  folderId: id.nullable().default(null),
  hue: z.enum(SET_HUES).default("mint"),
  icon: z.enum(SET_ICONS).default("books"),
  /** Hand-placed position among the folder's sets; null sorts by name. */
  order: z.number().finite().nullable().default(null),
});
export type SetInput = z.input<typeof setInput>;
export interface WordSet extends z.output<typeof setInput> {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface SetSummary extends WordSet {
  wordCount: number;
  questionCount: number;
}

export const senseInput = z.strictObject({
  id: id.optional(),
  pos: z.string().transform((value, context) => {
    const pos = normalizePos(value);
    if (!pos) context.addIssue({ code: "custom", message: `Unknown part of speech "${value}"` });
    return pos;
  }),
  /** The Chinese meaning: short, it is shown as an answer option. */
  meaning: text(200),
  examples: z.array(text(500)).max(20).default([]),
  /** Usage notes, one point per line. */
  description: optionalText(2000),
  /** Added later as an extra meaning, not from the word's original source. */
  supplementary: z.boolean().default(false),
});
export type SenseInput = z.input<typeof senseInput>;
export type Sense = Omit<z.output<typeof senseInput>, "id"> & { id: string };

export const wordInput = z.strictObject({
  id: id.optional(),
  word: text(200),
  starred: z.boolean().default(false),
  senses: z.array(senseInput).min(1).max(20),
});
export type WordInput = z.input<typeof wordInput>;
export interface Word {
  id: string;
  setId: string;
  word: string;
  starred: boolean;
  senses: Sense[];
  updatedAt: string;
}

const whyWrong = z.record(z.string().max(500), text(1000)).optional();

const item = z.strictObject({
  id: id.optional(),
  /** The 1-based blank this item fills; absent for reading items. */
  blank: z.number().int().positive().max(20).optional(),
  /** The question asked; reading items only. */
  prompt: optionalText(1000),
  /** This item's own options; absent when the passage has a shared bank. */
  options: z.array(text(500)).min(2).max(10).optional(),
  answer: z.number().int().nonnegative(),
  senseId: id,
  explanation: optionalText(4000),
  whyWrong,
});

export const questionInput = z.discriminatedUnion("kind", [
  z.strictObject({
    id: id.optional(),
    kind: z.literal("vocabulary"),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prompt: text(1000),
    options: z.array(text(200)).length(4),
    answer: z.number().int().min(0).max(3),
    senseId: id,
    explanation: optionalText(4000),
    whyWrong,
  }),
  z.strictObject({
    id: id.optional(),
    kind: z.enum(QUESTION_KINDS.filter((kind) => kind !== "vocabulary") as ["cloze", "wordBank", "discourse", "reading"]),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: optionalText(300),
    passage: text(20000),
    /** The shared options of wordBank and discourse. */
    bank: z.array(text(500)).max(10).optional(),
    items: z.array(item).min(1).max(10),
    explanation: optionalText(4000),
  }),
]);
export type QuestionInput = z.input<typeof questionInput>;
type ParsedQuestion = z.output<typeof questionInput>;
type Stored<T> = T & { id: string; setId: string; createdAt: string; updatedAt: string };
export type VocabularyQuestion = Stored<Extract<ParsedQuestion, { kind: "vocabulary" }>>;
export type PassageItem = Omit<z.output<typeof item>, "id"> & { id: string };
export type PassageQuestion = Stored<Omit<Exclude<ParsedQuestion, { kind: "vocabulary" }>, "items"> & { items: PassageItem[] }>;
export type Question = VocabularyQuestion | PassageQuestion;

/** Every sense a question practises. */
export function questionSenseIds(question: Pick<Question, "kind"> & ({ senseId: string } | { items: { senseId: string }[] })): string[] {
  return "items" in question ? [...new Set(question.items.map((entry) => entry.senseId))] : [question.senseId];
}

export const prefsInput = z.strictObject({
  /** Questions per practice round. */
  practiceSize: z.number().int().min(5).max(100).default(20),
  /** Show the Chinese meaning under each word in a set's list. */
  showMeanings: z.boolean().default(true),
  theme: z.enum(["system", "light", "dark"]).default("system"),
});
export type Prefs = z.output<typeof prefsInput>;



/** GET /library: every folder and set, without their words. */
export interface LibraryIndex {
  revision: number;
  folders: Folder[];
  sets: SetSummary[];
}
/** GET /sets/:id: one set with its words (A to Z) and questions. */
export interface SetContent {
  set: SetSummary;
  words: Word[];
  questions: Question[];
}
export interface QuestionReport {
  saved: string[];
  failed: { index: number; errors: { code: string; field: string; message: string }[] }[];
  warnings: { index: number; warnings: { code: string; field: string; message: string }[] }[];
}
