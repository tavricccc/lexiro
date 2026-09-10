import type {
  MultipleChoiceQuestion,
  QuestionDifficulty,
  QuestionStyle,
  WordEntry,
  WordSense,
} from "@/types";
import {
  buildQuestionFingerprint,
  buildQuestionId,
  normalizePartOfSpeech,
} from "./library";
import { SENTENCE_BLANK } from "./question-formats";

/**
 * Question assembly that needs no model.
 *
 * Everything a program can decide is decided here, because every field a model
 * has to produce is a field it can get wrong. The model is left with the one
 * job that genuinely needs language judgement — writing a natural sentence —
 * and even that sentence is handed back with the target word still in it, so
 * the blank is cut by code rather than typed by the model.
 *
 * Concretely, the following never come from a model:
 *   - the correct answer (it is the word we asked about)
 *   - the blank, its position, and the guarantee that there is exactly one
 *   - the distractors, whenever the learner's own library can supply them
 *   - the option order and therefore `answerIndex`
 *   - ids, fingerprints, timestamps, and the link back to the source sense
 */

export interface SenseRef {
  sense: WordSense;
  word: WordEntry;
}

export function listSenses(words: WordEntry[]): SenseRef[] {
  return words.flatMap((word) => word.senses.map((sense) => ({ sense, word })));
}

/** Deterministic per-seed shuffle, so a rebuilt question keeps its option order. */
function seededOrder(length: number, seed: string): number[] {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

/**
 * Places the answer among the distractors and reports where it landed. Callers
 * never pass an `answerIndex` in from outside, so it cannot be wrong.
 */
export function placeAnswer(
  answer: string,
  distractors: string[],
  seed: string,
): { answerIndex: number; options: string[] } {
  const pool = [answer, ...distractors];
  const order = seededOrder(pool.length, seed);
  const options = order.map((index) => pool[index]);
  return { answerIndex: order.indexOf(0), options };
}

const WORD_BOUNDARY = /[A-Za-z]/;

/**
 * Replaces the first standalone occurrence of `word` with a blank.
 *
 * Only an exact, whole-word match of the base form is accepted. Matching
 * inflections would mean inflecting the distractors to match, and English
 * irregulars make that a source of wrong options ("run" would become
 * "runed"), which is precisely the kind of error this module exists to avoid.
 * A sentence that does not contain the base form is simply not usable, and the
 * caller falls back to asking the model for one.
 */
export function blankOutWord(sentence: string, word: string): string | null {
  const target = word.trim().toLocaleLowerCase();
  if (!target) return null;
  const haystack = sentence.toLocaleLowerCase();
  let from = 0;
  while (from <= haystack.length - target.length) {
    const at = haystack.indexOf(target, from);
    if (at === -1) return null;
    const before = at === 0 ? "" : sentence[at - 1];
    const after = sentence[at + target.length] ?? "";
    if (!WORD_BOUNDARY.test(before) && !WORD_BOUNDARY.test(after))
      return `${sentence.slice(0, at)}${SENTENCE_BLANK}${sentence.slice(at + target.length)}`;
    from = at + 1;
  }
  return null;
}

/** True when the sentence can carry a blank for this word without help. */
export function sentenceCarriesWord(sentence: string, word: string): boolean {
  return blankOutWord(sentence, word) !== null;
}

/**
 * Distractors taken from the learner's own library: other words of the same
 * part of speech. This is how a 段考 paper is written — the wrong options are
 * words from the same unit — and it removes distractor invention from the
 * model's job entirely.
 */
export function libraryDistractors(
  target: WordEntry,
  pos: string,
  pool: WordEntry[],
  count: number,
  seed: string,
): string[] {
  const wanted = normalizePartOfSpeech(pos) || pos.trim();
  const targetKey = target.wordKey;
  const candidates = pool
    .filter((entry) => entry.wordKey !== targetKey)
    .filter((entry) =>
      entry.senses.some(
        (sense) =>
          (normalizePartOfSpeech(sense.pos) || sense.pos.trim()) === wanted,
      ),
    )
    .map((entry) => entry.word.trim())
    .filter(
      (word) =>
        word.length > 0 &&
        word.toLocaleLowerCase() !== target.word.trim().toLocaleLowerCase(),
    );
  const unique = [...new Set(candidates)];
  return seededOrder(unique.length, seed)
    .map((index) => unique[index])
    .slice(0, count);
}

export interface BuiltQuestion {
  question: MultipleChoiceQuestion;
  /** Why a sense produced nothing, for the caller to report or fall back on. */
  skipped?: never;
}

function assemble(
  word: WordEntry,
  sense: WordSense,
  prompt: string,
  answer: string,
  distractors: string[],
  difficulty: QuestionDifficulty,
  style: QuestionStyle,
): MultipleChoiceQuestion {
  const seed = `${word.wordKey}:${sense.id}:${style}:${difficulty}`;
  const { answerIndex, options } = placeAnswer(answer, distractors, seed);
  const content: Omit<
    MultipleChoiceQuestion,
    "createdAt" | "fingerprint" | "id" | "updatedAt"
  > = {
    answerIndex,
    difficulty,
    kind: "multipleChoice",
    options,
    prompt,
    questionStyle: style,
    senseId: sense.id,
    wordKey: word.wordKey,
  };
  const now = new Date().toISOString();
  return {
    ...content,
    createdAt: now,
    fingerprint: buildQuestionFingerprint(content),
    id: buildQuestionId(),
    updatedAt: now,
  };
}

/**
 * A 詞彙題 built entirely from stored data: the learner's own example sentence
 * with the target word blanked out, and three same-part-of-speech words from
 * their library as distractors. No request is made.
 */
export function buildVocabularyFromLibrary(
  word: WordEntry,
  sense: WordSense,
  pool: WordEntry[],
  difficulty: QuestionDifficulty = 2,
): MultipleChoiceQuestion | null {
  const source = sense.examples.find((example) =>
    sentenceCarriesWord(example, word.word),
  );
  if (!source) return null;
  const prompt = blankOutWord(source, word.word);
  if (!prompt) return null;
  const distractors = libraryDistractors(
    word,
    sense.pos,
    pool,
    3,
    `${sense.id}:distractors`,
  );
  if (distractors.length < 3) return null;
  return assemble(
    word,
    sense,
    prompt,
    word.word.trim(),
    distractors,
    difficulty,
    "vocabulary",
  );
}

/**
 * Builds what it can without a model and reports what is left over, so the
 * caller can spend requests only on the senses that actually need one.
 */
export function buildLibraryQuestions(
  words: WordEntry[],
  pool: WordEntry[],
  difficulty: QuestionDifficulty = 2,
): { built: MultipleChoiceQuestion[]; remaining: WordEntry[] } {
  const built: MultipleChoiceQuestion[] = [];
  const remaining: WordEntry[] = [];
  for (const word of words) {
    const unmet: WordSense[] = [];
    for (const sense of word.senses) {
      const question = buildVocabularyFromLibrary(
        word,
        sense,
        pool,
        difficulty,
      );
      if (question) built.push(question);
      else unmet.push(sense);
    }
    if (unmet.length) remaining.push({ ...word, senses: unmet });
  }
  return { built, remaining };
}
