import type { QuestionKind, QuestionSource } from "@lexiro/ai-contract";
import { PASSAGE_FORMATS, READING_MIN_QUESTIONS, READING_MAX_QUESTIONS, questionLengthRange } from "@lexiro/ai-contract";
import { COMMON_QUESTION_BRIEF } from "./question-brief";

type QuestionDifficulty = 1 | 2 | 3;
export const QUESTION_CACHE_KEY = "lexiro-questions-20261009-v20";
export const TASK_RULES = COMMON_QUESTION_BRIEF;
const DIFFICULTY: Record<QuestionDifficulty, string> = {
  1: "Difficulty 1: direct, sufficient clues and simple high-school sentence structures.",
  2: "Difficulty 2: use collocation, contrast, adjacent context and basic integration. Reading includes main idea and inference.",
  3: "Difficulty 3: use reference, stance or necessary facts across sentences. Reading inference requires two different necessary facts. Keep the English accessible.",
};

const FORMAT_RULES: Record<QuestionKind, string> = {
  vocabulary: `Vocabulary purpose: one useful meaning or word-form distinction per activeRef, at most sixteen sources.
Write distractors first, then a complete natural context. Finish the answer-substitution and explanation checks for one source before moving to the next. Meaning items keep all four choices grammatical; a source such as be may instead teach an actually selected form. Keep each context in the current length range and source order.
Copy the source's actual form into usage and answer. For one word they are identical; a phrase keeps its complete realized usage with the actual tested word inside it as answer. Each item has distractors, sentence, usage, answer, explanation and three linked whyWrong objects. The source meaning and the scene must agree. A definition alone is not an excuse for unrelated or equally acceptable candidates.`,

  cloze: `Cloze purpose: learn how meaning and grammar work inside one connected passage, rather than solve five unrelated vocabulary sentences.
One coherent passage and one blank per activeRef, at most five. Include every supplied target naturally in its sense. A blank can test that target or a related grammatical construction in the same source's sentence. A five-blank set has two grammatical-form items and three meaning/collocation items; use suitable locations in the story rather than forcing grammar into the first two sources. Follow the grammar and meaning counts in the current specification for a shorter set.
For grammar, the learner should recognize why the surrounding construction selects that form. Leave a selecting auxiliary outside the answer and compare forms of the same word. Example contexts and complete individual blanks:
Context: By Friday, the library's continual repairs had been completed.
{"answer":"been","distractors":["be","being","is"],"explanation":"had 後接過去分詞；been 與 completed 構成過去完成被動，表示週五以前修繕已完成。","whyWrong":[{"option":"be","reason":"had 後不能直接用 be 原形形成這個完成被動。"},{"option":"being","reason":"being 不能接在 had 後形成 had been completed 的完成被動。"},{"option":"is","reason":"is 是現在式，不能接在 had 後構成此句。"}]}
Context: Using last year's records, the team could estimate the cost.
{"answer":"estimate","distractors":["estimates","estimated","estimating"],"explanation":"could 是情態助動詞，後面用動詞原形 estimate。","whyWrong":[{"option":"estimates","reason":"could 後不用第三人稱單數 estimates。"},{"option":"estimated","reason":"could 後不用過去式 estimated。"},{"option":"estimating","reason":"此處 could 後直接接原形，不能接 estimating。"}]}
These demonstrate grammar selection; their source words remain in the context even when a different grammar word is blanked. By contrast, choosing between had cracked and cracked merely because one event was earlier may leave two grammatical readings. For meaning items, passage events, contrast or cause should distinguish the choices.
Every blank has answer, three distractors, explanation and three linked reasons. Keep activeRef order even if their passage locations differ. Answers are distinct and occur once in the full prose. Complete each blank's checks before the next, then reread all blanks together for a coherent story and the intended mixture. Keep the full passage length even with fewer blanks.`,

  wordBank: `Word-bank purpose: follow a passage's meaning and place words through local clues and a unique complete allocation.
One coherent passage with ten shared options. Use each supplied source as an answer in its intended sense and natural actual form; for a phrase source, use its actual inflected head as the bank answer and retain the rest of the expression in the passage. Write full prose, finalize options, then prepare the blanks and reasons using that fixed bank. Ten sources produce ten blanks and no unused options; fewer sources leave enough unused options to reach ten. Every answer belongs to the bank and occurs once; unused options do not occur in the prose.
Names and pronouns can keep a role noun from being printed again. An exact answer in another part of speech or compound still repeats that word. Keep full passage length.
Each blank has answer, explanation and nine {option, reason} objects quoting the other actual options. Explain the candidate's meaning and collocation here, using the surrounding facts. For example, estimate is a calculation or prediction, which does not name money spent to improve a project; witness can be a verb, but seeing an event does not mean predicting a future quantity. These are contextual differences, not claims that those words have only one part of speech.
Check every option in every location, then hide all answers and check the whole allocation. Especially try each unused option: automatic cannot be rejected from a timer operated on a fixed schedule just because mechanical is the supplied source. Every reason must correspond to this final bank. Clear weaker options are fine; an unsupported attribute-based rejection or a second natural allocation needs a different candidate or meaningful context.`,

  discourse: `Discourse purpose: learn how surrounding sentences connect, using reference, detail, contrast, cause and result.
One passage with at least ten complete sentences in three to five paragraphs, four removed sentences and five shared sentence options. Keep its opening and closing. A complete original sentence remains between any two removals, so each learner has usable neighboring clues. Use the supplied target senses naturally.
Choose four complete sentences with different jobs in the text and copy them exactly, including punctuation. Link both sides: for example, a prior observation leads to a specific result that the following sentence then discusses. Two independent setup actions often remain interchangeable; their mere preferred order is a weak reason to reject a swap.
Finalize five options before explaining the four removals. Four are actual original sentences; the unused fifth states a related fact incompatible with the known context and remains outside the passage. Closing a library permanently before a project conflicts with its later open-room measurements; an optional suggestion does not become false merely because it was never chosen.
Each removal has sentence, explanation and four linked reasons. Complete one location's check before the next, then hide all four sentences at once. Try the five actual options at all locations, verify the entire arrangement and neighbor clues, and check that no unused incompatible sentence accidentally became part of the narrative.`,

  reading: `Reading purpose: distinguish what the text states, what it refers to, what it is mainly about, and what follows from combining its facts.
One passage and ${READING_MIN_QUESTIONS} to ${READING_MAX_QUESTIONS} four-choice questions. Use every supplied word naturally in its intended sense. Include mainIdea and another skill; difficulty 2 and 3 also include inference. Valid skills: mainIdea, detail, inference, reference, vocabulary. Select skill and its exact necessary evidence before writing question, answer and distractors.
For inference, prepare two separate necessary facts while drafting the passage, leaving their combined conclusion for the question's answer. Here is a focused passage and one complete inference item:
Passage: The club had only one microscope available for examining the samples. Three groups needed to examine their samples through a microscope during the same lesson. The teacher asked each group to bring its sample list.
{"skill":"inference","evidence":["The club had only one microscope available for examining the samples.","Three groups needed to examine their samples through a microscope during the same lesson."],"question":"What arrangement would the groups need to make?","answer":"They would need to agree on different times to use the microscope.","distractors":["They could all use separate microscopes at the same time.","They would need to prepare samples because none were available.","They would need to replace a broken microscope before the lesson."],"explanation":"只有一台顯微鏡，卻有三組在同一堂課需要使用；合併這兩個條件，可推知必須協調使用時段。","whyWrong":[{"option":"They could all use separate microscopes at the same time.","reason":"可用顯微鏡只有一台，無法同時各用一台。"},{"option":"They would need to prepare samples because none were available.","reason":"本文提到各組樣本，沒有樣本全都缺少的依據。"},{"option":"They would need to replace a broken microscope before the lesson.","reason":"本文說的是數量與同時使用需求，沒有顯微鏡損壞的資訊。"}]}
Without the first fact, there might be enough equipment; without the second, no shared demand requires an arrangement. The answer is unstated and needs both. Apply that relationship to the real story rather than copying this topic.
A correct answer can still have the wrong skill label. Consider this passage: The sensors gave matching readings during three weeks of tests. The club selected them because those results were consistent.
{"skill":"inference","evidence":["The sensors gave matching readings during three weeks of tests.","The club selected them because those results were consistent."],"question":"Why did the club select the sensors?","answer":"Because the test readings were consistent.","distractors":["Because they came from a famous company.","Because they were tested only once.","Because they worked without any moving parts."],"explanation":"文章直接說明選擇感測器是因為測試結果一致。","whyWrong":[{"option":"Because they came from a famous company.","reason":"本文沒有以公司名聲作為選擇依據。"},{"option":"Because they were tested only once.","reason":"測試持續三週，不是只測一次。"},{"option":"Because they worked without any moving parts.","reason":"本文沒有以零件或運作方式作為選擇依據。"}]}
This is a detail item mislabeled inference: the second quote alone gives the complete answer. Relabel it detail and create a genuine two-fact item for the required inference. These demonstrate individual questions, not the real set's required passage length or number of questions.
Finish each question's skill, evidence, option-substitution and explanation checks before the next. Inference loses its conclusion when either necessary fact is removed; detail can quote a direct statement. Main idea represents the passage, and reference identifies the actual referent. Choices should be comparable in structure and specificity; their errors can concern actor, time, scope, cause or an unsupported conclusion. The final set covers different information without leaking another question's answer. Each question has three linked whyWrong objects.`,
};

function clozeCounts(count: number) {
  const grammarItems = Math.min(2, Math.floor(count / 2));
  return { grammarItems, meaningItems: count - grammarItems };
}

export function questionPrompt(kind: QuestionKind, sources: QuestionSource[], difficulty: QuestionDifficulty) {
  const lengthRange = questionLengthRange(kind, difficulty);
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
  if (kind === "wordBank") return scope + `One passage, exactly ${refs.length} blanks and ${PASSAGE_FORMATS.wordBank.optionCount} options, including ${Math.max(0, PASSAGE_FORMATS.wordBank.optionCount - refs.length)} unused options. Keep the full passage length and verify the complete allocation.`;
  return scope + "One complete passage set; finish individual checks, then check the set.";
}
