import {
  blankNumbers,
  countEnglishWords,
  LENGTH_RANGES,
  PASSAGE_SPECS,
  READING_ITEMS,
  SENTENCE_BLANK,
} from "./formats";
import { questionInput, type PassageItem, type Question } from "./schema";
import { newId } from "./words";

export interface Issue {
  code: string;
  /** Dotted path to the offending field, e.g. `items.2.answer`. */
  field: string;
  message: string;
}

/** A checked question, before the set and timestamps are stamped on it. */
export type CheckedQuestion = Question extends infer Q ? (Q extends Question ? Omit<Q, "setId" | "createdAt" | "updatedAt"> : never) : never;

export type QuestionCheck =
  | { ok: true; question: CheckedQuestion; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

const distinct = (values: string[]) => new Set(values.map((value) => value.toLocaleLowerCase())).size === values.length;

/**
 * Checks one question against its format and against the senses of the set it
 * goes into. `senses` maps every sense id of the set to its word. Structure and
 * format rules are errors; length outside the editorial range is a warning.
 */
export function checkQuestion(value: unknown, senses: ReadonlyMap<string, string>): QuestionCheck {
  const parsed = questionInput.safeParse(value);
  if (!parsed.success)
    return {
      ok: false,
      warnings: [],
      errors: parsed.error.issues.slice(0, 5).map((issue) => ({
        code: "invalid_structure",
        field: issue.path.join(".") || "question",
        message: issue.message,
      })),
    };
  const input = parsed.data;
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const fail = (field: string, code: string, message: string) => errors.push({ field, code, message });
  const sense = (field: string, senseId: string) => {
    if (!senses.has(senseId)) fail(field, "unknown_sense", `Sense ${senseId} is not in this set`);
  };
  const whyWrong = (field: string, options: string[], answer: number, reasons?: Record<string, string>) => {
    for (const key of Object.keys(reasons ?? {}))
      if (!options.includes(key) || key === options[answer])
        fail(field, "invalid_why_wrong", `whyWrong key "${key}" is not a wrong option`);
  };

  if (input.kind === "vocabulary") {
    if (input.prompt.split(SENTENCE_BLANK).length !== 2)
      fail("prompt", "blank_count", `The prompt must contain exactly one ${SENTENCE_BLANK}`);
    if (!distinct(input.options)) fail("options", "duplicate_option", "Options must differ");
    sense("senseId", input.senseId);
    whyWrong("whyWrong", input.options, input.answer, input.whyWrong);
    const words = countEnglishWords(input.prompt);
    const [min, max] = LENGTH_RANGES.vocabulary[input.difficulty];
    if (words < min || words > max)
      warnings.push({ field: "prompt", code: "length", message: `The sentence has ${words} words; difficulty ${input.difficulty} expects ${min}–${max}` });
    if (errors.length) return { ok: false, errors, warnings };
    return { ok: true, warnings, question: { ...input, id: input.id ?? newId("q") } };
  }

  const spec = PASSAGE_SPECS[input.kind];
  const blanks = blankNumbers(input.passage);
  if (input.kind === "reading") {
    if (blanks.length) fail("passage", "blank_count", "A reading passage has no blanks");
    if (input.items.length < READING_ITEMS.min || input.items.length > READING_ITEMS.max)
      fail("items", "item_count", `A reading passage asks ${READING_ITEMS.min}–${READING_ITEMS.max} questions`);
  } else {
    if (!blanks.length || blanks.length > spec.blanks)
      fail("passage", "blank_count", `${input.kind} has 1–${spec.blanks} blanks`);
    if (blanks.some((number, index) => number !== index + 1))
      fail("passage", "blank_order", "Blanks are numbered __1__, __2__, … in order");
    if (input.items.length !== blanks.length)
      fail("items", "item_count", `The passage has ${blanks.length} blanks but ${input.items.length} items`);
  }
  if (spec.sharedBank) {
    if (input.bank?.length !== spec.options) fail("bank", "bank_size", `${input.kind} offers exactly ${spec.options} shared options`);
    else if (!distinct(input.bank)) fail("bank", "duplicate_option", "Bank options must differ");
    const answers = input.items.map((entry) => entry.answer);
    if (new Set(answers).size !== answers.length) fail("items", "bank_reuse", "Each bank option answers at most one blank");
  } else if (input.bank) fail("bank", "unexpected_bank", `${input.kind} has no shared bank`);

  const items: PassageItem[] = input.items.map((entry, index) => {
    const field = `items.${index}`;
    sense(`${field}.senseId`, entry.senseId);
    if (input.kind === "reading") {
      if (!entry.prompt) fail(`${field}.prompt`, "missing_prompt", "A reading item needs its question");
      if (entry.blank !== undefined) fail(`${field}.blank`, "unexpected_blank", "A reading item fills no blank");
    } else if (entry.blank !== index + 1) fail(`${field}.blank`, "blank_order", `Item ${index + 1} fills blank ${index + 1}`);
    const options = spec.sharedBank ? input.bank ?? [] : entry.options ?? [];
    if (spec.sharedBank && entry.options) fail(`${field}.options`, "unexpected_options", "Items of a shared bank have no options of their own");
    if (!spec.sharedBank) {
      if (options.length !== spec.options) fail(`${field}.options`, "option_count", `Each item has ${spec.options} options`);
      else if (!distinct(options)) fail(`${field}.options`, "duplicate_option", "Options must differ");
    }
    if (entry.answer >= options.length) fail(`${field}.answer`, "answer_range", "The answer is not one of the options");
    whyWrong(`${field}.whyWrong`, options, entry.answer, entry.whyWrong);
    return { ...entry, id: entry.id ?? newId("item") };
  });
  const words = countEnglishWords(input.passage);
  const [min, max] = LENGTH_RANGES[input.kind][input.difficulty];
  if (words < min || words > max)
    warnings.push({ field: "passage", code: "length", message: `The passage has ${words} words; difficulty ${input.difficulty} expects ${min}–${max}` });
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, warnings, question: { ...input, id: input.id ?? newId("q"), items } };
}

/** The options an item is answered from: its own, or the passage's shared bank. */
export function itemOptions(question: Extract<Question, { items: unknown }>, entry: PassageItem): string[] {
  return entry.options ?? question.bank ?? [];
}
