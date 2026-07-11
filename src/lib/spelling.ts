/** Normalize spelling answers for comparison (case, whitespace). */
export function normalizeSpellingAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** True when both answers match after normalization. Empty user answer is never correct. */
export function isSpellingAnswerCorrect(userAnswer: string, correctWord: string): boolean {
  const normalized = normalizeSpellingAnswer(userAnswer)
  if (!normalized)
    return false
  return normalized === normalizeSpellingAnswer(correctWord)
}
