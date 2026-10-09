import type { QuestionKind, QuestionSource } from "@lexiro/ai-contract";
import { PASSAGE_FORMATS, READING_MIN_QUESTIONS, READING_MAX_QUESTIONS, questionLengthRange } from "@lexiro/ai-contract";
import { COMMON_QUESTION_BRIEF } from "./question-brief";

type QuestionDifficulty = 1 | 2 | 3;
export const QUESTION_CACHE_KEY = "lexiro-questions-20261009-v18";
export const TASK_RULES = COMMON_QUESTION_BRIEF;
const DIFFICULTY: Record<QuestionDifficulty, string> = {
  1: "Difficulty 1: direct, sufficient clues and simple high-school sentence structures.",
  2: "Difficulty 2: use collocation, contrast, adjacent context and basic integration. Reading includes main idea and inference.",
  3: "Difficulty 3: use reference, stance or necessary facts across sentences. Reading inference requires two different necessary facts. Keep the English accessible.",
};

function formatRules(kind: QuestionKind): string {
  if (kind === "vocabulary") return `Vocabulary: one item per activeRef, at most sixteen sources. Write distractors first, then a complete one- or two-sentence context that naturally rules out each chosen distractor. Keep each situation within the supplied length range. Copy the target's actual inflection into usage and answer; for a single word these strings are identical. Each item has distractors, sentence, usage, answer, explanation and three linked whyWrong objects. Keep source order. All four candidates fit the grammar; only the answer fits the supplied facts.`;
  if (kind === "cloze") return `Cloze: one coherent passage with one blank per activeRef, at most five blanks. Develop a connected story or explanation. Use every target in its supplied sense. The first two blanks, or the only blank in a one-source set, test an auxiliary-selected verb form in the corresponding source's sentence. Leave the selecting auxiliary outside the answer span: a modal selects the base form; a perfect auxiliary selects the past participle. Contrast that form with three incompatible forms of the same word. Keep the target in the sentence even when the blank tests a related grammar word. Other blanks test source meaning through the passage's actual events, mechanism, cause or result. Each blank has answer, three distractors, explanation and three linked whyWrong objects. Answers occur once in the full passage and are distinct. Keep activeRef order, even if their locations in the passage differ. Retain the full passage length when there are fewer blanks.`;
  if (kind === "wordBank") return `Word bank: one coherent passage and ten shared options. Write the full passage, then finalize options before explaining blanks. Every activeRef supplies one blank answer in the specified sense and part of speech. An answer is the target's actual inflected word, copied from the passage. Use each answer once; all answers are distinct. Ten sources mean ten blanks with no unused options. Fewer sources mean fewer blanks and enough unused options to reach ten. Unused options must not occur in the passage. Shared options include every actual answer. Give characters names when introduced and use those names afterward, so a role noun is not printed repeatedly. The exact answer word still counts as a repetition when later used in another part of speech or a compound. The passage retains the full difficulty-specific length. Check every option in every location; the local sentence and surrounding context select one option, and the whole allocation is unique. Each blank has answer, explanation and nine linked whyWrong objects quoting the other actual options. Some options may be easier to exclude; prioritize an answerable set.`;
  if (kind === "discourse") return `Discourse: one passage of at least ten complete sentences, in three to five paragraphs; four sentence removals and five shared sentence options. Use the supplied target senses naturally. Keep the opening and closing sentences. Remove no adjacent sentences: at least one complete sentence remains between two removals. Each removal is a complete sentence copied exactly, including punctuation. Its preceding and following text both provide a specific connection through reference, contrast, cause, result or details. Each sentence fits its own location only. Finalize the five options before writing removals and explanations. Four options are the actual removed sentences; the fifth asserts a related fact incompatible with the known context at every location. Keep that unused sentence out of the passage. A reversible suggestion or optional background fact is not enough to make it incompatible. Each removal has sentence, explanation and four linked whyWrong objects. Check the actual five sentences at all four locations, with the removed sentences hidden.`;
  return `Reading: one passage and ${READING_MIN_QUESTIONS} to ${READING_MAX_QUESTIONS} four-choice questions. Include every supplied word as its actual word or ordinary inflection, with the supplied sense and part of speech. Use distinct information or reading operations across questions. Include mainIdea and at least one other skill; difficulty 2 and 3 also include inference. Valid skills are mainIdea, detail, inference, reference and vocabulary. Write question, skill and exact evidence before the answer and distractors. Quote complete supporting sentences from the final passage. An inference needs at least two different necessary sentences: either alone must not already state the complete answer. Its answer follows from combining their facts, without inventing motives or other information. Main idea covers the passage, rather than one small detail. Reading distractors can misread the actor, chronology, scope or cause, or make an unsupported conclusion based on real passage details. Compare their actual claims, not merely their wording. Each question has three linked whyWrong objects. Keep choices comparable in length and structure, and avoid one question revealing another answer.`;
}

export function questionPrompt(kind: QuestionKind, sources: QuestionSource[], difficulty: QuestionDifficulty) {
  const lengthRange = questionLengthRange(kind, difficulty);
  const target = Math.round((lengthRange.min + lengthRange.max) / 2);
  return {
    instructions: [TASK_RULES, Object.values(DIFFICULTY).join("\n"), formatRules(kind), "Return only one JSON object conforming to the supplied schema."].join("\n\n"),
    cachePrefix: TASK_RULES,
    cacheKey: QUESTION_CACHE_KEY,
    input: "Current specification: " + JSON.stringify({ difficulty, lengthRange }) +
      `\nAim for ${target - (kind === "vocabulary" ? 2 : 10)}–${target + (kind === "vocabulary" ? 2 : 10)} English words in each complete ${kind === "vocabulary" ? "context" : "passage"}. The allowed range is ${lengthRange.min}–${lengthRange.max}. Keep all answers in the prose; the program creates blanks.\nSources: ` +
      JSON.stringify(sources) + "\n" + questionTurnInstruction(sources.map((source) => source.ref), kind),
  };
}

export function questionTurnInstruction(refs: string[], kind: QuestionKind): string {
  const scope = `Current activeRefs: ${JSON.stringify(refs)}. Return this task's complete JSON only. `;
  if (kind === "vocabulary") return scope + `Exactly ${refs.length} items, one per activeRef in source order.`;
  if (kind === "cloze") return scope + `One passage, exactly ${refs.length} blanks. The first ${Math.min(2, refs.length)} blanks test an auxiliary-selected form, with the auxiliary left outside the answer span. Other blanks test the supplied meaning through concrete passage clues.`;
  if (kind === "wordBank") return scope + `One passage, exactly ${refs.length} blanks and ${PASSAGE_FORMATS.wordBank.optionCount} options, including ${Math.max(0, PASSAGE_FORMATS.wordBank.optionCount - refs.length)} unused options. Keep the full passage length.`;
  return scope + "One complete passage set.";
}
