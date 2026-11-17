import { LENGTH_RANGES, PASSAGE_SPECS, READING_ITEMS, type QuestionKind } from "./contract";

/** One word the brief hands to the writer, keyed by its ref. */
interface QuestionSource { ref: string }
import { COMMON_QUESTION_BRIEF, TEACHING_CORE } from "./question-brief";

type QuestionDifficulty = 1 | 2 | 3;
export const QUESTION_CACHE_KEY = "lexiro-questions-20261117-v27";
export const TASK_RULES = COMMON_QUESTION_BRIEF;
const DIFFICULTY: Record<QuestionDifficulty, string> = {
  1: "Difficulty 1: direct, sufficient clues and simple high-school sentence structures.",
  2: "Difficulty 2: use collocation, contrast, adjacent context and basic integration. Reading includes main idea and inference.",
  3: "Difficulty 3: use reference, stance or necessary facts across sentences. Reading inference requires two different necessary facts. Keep the English accessible.",
};

const FORMAT_RULES: Record<QuestionKind, string> = {
  vocabulary: `Vocabulary: one item per activeRef. Each has sentence, usage, answer, three distractors, explanation, whyWrong. Meaning items keep all four choices grammatical in the hole; a form item compares forms of the same word.`,
  cloze: `Cloze: one coherent passage, one blank per activeRef, each target used naturally. Mix grammar-form and meaning blanks per the specification counts. A grammar blank compares forms of one word and the surrounding construction must select exactly one (keep the selecting auxiliary outside the answer). Meaning blanks are decided by passage events, contrast or cause. Each blank: usage, answer, three distractors, explanation, whyWrong.`,
  wordBank: `Word bank: one coherent passage, one blank per activeRef, and a shared bank of exactly the specified number of options (unused options fill the rest). Each blank gives ref copied from its source, usage, answer and one explanation. Write optionMeanings once: every bank option with its short Chinese meaning in this passage. Try every option in every blank: the complete allocation must be unique, and no unused option may naturally fit any blank.`,
  discourse: `Discourse: a passage of at least ten sentences in three to five paragraphs, with four removed complete sentences and five shared options (four originals plus one unused). Keep the opening and closing; leave at least one original sentence between removals. Each removed sentence must link to clues on both sides (reference, contrast, cause, result). The unused option is related but contradicts the known context. Each removal has sentence (copied exactly) and one explanation; add unusedReason. Check that the five options allow only one arrangement.`,
  reading: `Reading: one passage and ${READING_ITEMS.min} to ${READING_ITEMS.max} four-choice questions; use every source naturally. Include mainIdea plus other skills (mainIdea, detail, inference, reference, vocabulary); difficulty 2-3 must include inference. Quote evidence sentences exactly. An inference needs two separate necessary facts in the passage and its conclusion appears only in the answer; if one quote alone answers it, it is a detail item. Choices are comparable in structure; errors may concern actor, time, scope, cause or unsupported conclusions.`,
};

function clozeCounts(count: number) {
  const grammarItems = Math.min(2, Math.floor(count / 2));
  return { grammarItems, meaningItems: count - grammarItems };
}

export function questionPrompt(kind: QuestionKind, sources: QuestionSource[], difficulty: QuestionDifficulty) {
  const [min, max] = LENGTH_RANGES[kind][difficulty];
  const lengthRange = { min, max };
  const target = Math.round((lengthRange.min + lengthRange.max) / 2);
  const textContract = kind === "reading"
    ? "Keep supporting facts in the passage; the inference conclusion belongs in its answer."
    : "Keep the original blank or removal answers in the prose; the program makes blanks.";
  return {
    instructions: [TASK_RULES, Object.values(DIFFICULTY).join("\n"), FORMAT_RULES[kind], "Return only one JSON object conforming to the supplied schema."].join("\n\n"),
    cachePrefix: TASK_RULES,
    cacheKey: QUESTION_CACHE_KEY,
    input: "Current specification: " + JSON.stringify({ difficulty, lengthRange, ...(kind === "cloze" ? clozeCounts(sources.length) : {}) }) +
      `\nAim for ${target - (kind === "vocabulary" ? 2 : 10)}–${target + (kind === "vocabulary" ? 2 : 10)} English words in each complete ${kind === "vocabulary" ? "context" : "passage"}. The allowed range is ${lengthRange.min}–${lengthRange.max}. ${textContract}\nSources: ` +
      JSON.stringify(sources) + "\n" + questionTurnInstruction(sources.map((source) => source.ref), kind),
  };
}

export function questionTurnInstruction(refs: string[], kind: QuestionKind): string {
  const scope = `Current activeRefs: ${JSON.stringify(refs)}. Return this task's complete JSON only. `;
  if (kind === "vocabulary") return scope + `Exactly ${refs.length} items, one per activeRef in source order; finish each item's checks before the next.`;
  if (kind === "cloze") {
    const { grammarItems, meaningItems } = clozeCounts(refs.length);
    return scope + `One passage, exactly ${refs.length} blanks in source order: ${grammarItems} grammar-form items and ${meaningItems} meaning/collocation items at suitable locations. Check the complete passage afterward.`;
  }
  if (kind === "wordBank") return scope + `One passage, exactly ${refs.length} blanks and ${PASSAGE_SPECS.wordBank.options} options, including ${Math.max(0, PASSAGE_SPECS.wordBank.options - refs.length)} unused options. Keep the full passage length and verify the complete allocation.`;
  return scope + "One complete passage set; finish individual checks, then check the set.";
}

/**
 * 自由題型: the Agent designs the exercise and writes stored-format questions
 * with put_questions. There is no output schema to fill and no blank cutting.
 */
export const CUSTOM_RULES = `自由題型 (kind "custom"): you design the exercise for Taiwanese high-school learners and save it with write put_questions, in stored format.

Choosing the format
- If the user names a format, follow it. Otherwise pick what best teaches these words: collocation choice, register or tone, error correction, synonym swap, word-form typing, spelling from Chinese, sentence ordering, word–meaning matching, or your own. Vary formats across questions.
- label is a short Traditional Chinese name for the format (at most 12 characters, e.g. 搭配詞判斷). Reuse the same label for the same format; existing labels come with brief.
- instructions (optional, Traditional Chinese) says how to answer when the format is new. passage (optional) is shared English text for all items.

Shape: {kind:"custom", difficulty:1|2|3, label, instructions?, passage?, items:[1–10 items]}. Each item has mode, prompt, senseId (from brief sources), explanation (Traditional Chinese, teaches the clue), plus by mode:
- single: options (2–6, all different), answer (index), whyWrong? ({option: reason} for wrong options).
- multiple: options (2–8), answers (indices) — right only when exactly these are picked; the prompt says to pick all that apply. whyWrong? for wrong options only.
- input: accepted — every acceptable answer, e.g. ["colour","color"] or ["can't","cannot"]. Case, spacing, curly quotes and a final full stop are ignored. Ask for one short word or phrase so the answer is checkable.
- order: pieces in the right order (2–10, all different). The app shuffles them; exactly one order may be grammatical and sensible.
- match: pairs [[left, right]] (2–8, each side all different). The app shuffles the right column; each left has only one fitting right.

Teaching core
${TEACHING_CORE}
- For choices and match pieces, draw on setWords as well, so the learner cannot answer by spotting the one studied word.`;
