import type { StudyWord } from "@/types";
import { normalizeWordKey } from "@/src/lib/library";
import { seededShuffle, type QuestionItem } from "./practice-content";

/** Ignore presentation punctuation when comparing saved Chinese meanings. */
export function meaningKey(meaning: string): string {
  return meaning.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");
}

function meaningParts(meaning: string): string[] {
  return meaning
    .split(/[，、；;／/]|(?:\s+或\s+)/u)
    .map(meaningKey)
    .filter(Boolean);
}

/** Every sense may supply the answer, but none may appear as a distractor. */
export function buildMeaningQuestionGroups(
  words: readonly StudyWord[],
): QuestionItem[][] {
  const byWord = new Map<string, StudyWord[]>();
  const excludedBySpelling = new Map<string, Set<string>>();
  for (const word of words) {
    const senses = byWord.get(word.wordKey) ?? [];
    senses.push(word);
    byWord.set(word.wordKey, senses);
    const spelling = normalizeWordKey(word.word);
    const excluded = excludedBySpelling.get(spelling) ?? new Set<string>();
    meaningParts(word.meaning).forEach((part) => excluded.add(part));
    excludedBySpelling.set(spelling, excluded);
  }
  return words.flatMap((word) => {
    const senses = byWord.get(word.wordKey)!;
    const acceptedMeanings = [
      ...new Set(senses.map((sense) => sense.meaning.trim())),
    ];
    const spelling = normalizeWordKey(word.word);
    const excluded = excludedBySpelling.get(spelling)!;
    const seen = new Set<string>();
    const distractors = seededShuffle(
      [...words],
      `meaning:${word.id}:distractors`,
    )
      .filter((other) => {
        if (normalizeWordKey(other.word) === spelling) return false;
        const key = meaningKey(other.meaning);
        const parts = meaningParts(other.meaning);
        if (
          !key ||
          !parts.length ||
          parts.some((part) => excluded.has(part)) ||
          seen.has(key)
        )
          return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map((other) => other.meaning.trim());
    if (distractors.length !== 3) return [];
    const id = `meaning:${word.id}`;
    const options = seededShuffle([word.meaning.trim(), ...distractors], id);
    return [
      [
        {
          id,
          question: null,
          prompt: word.word,
          options,
          answerIndex: options.indexOf(word.meaning.trim()),
          wordKey: word.wordKey,
          senseId: word.id,
          type: "meaning" as const,
          difficulty: 1 as const,
          meaning: acceptedMeanings.join("；"),
          acceptedMeanings,
        },
      ],
    ];
  });
}

export function isCorrectChoice(item: QuestionItem, choice: number): boolean {
  if (item.type !== "meaning") return choice === item.answerIndex;
  const option = item.options[choice];
  return (
    option !== undefined &&
    Boolean(
      item.acceptedMeanings?.some(
        (meaning) => meaningKey(meaning) === meaningKey(option),
      ),
    )
  );
}
