export * from "./words";
export * from "./formats";

export const TIERS = ["lite", "thinking", "pro"] as const;
export type Tier = typeof TIERS[number];
export const MULTIPLIER: Record<Tier, number> = { lite: 1, thinking: 2, pro: 8 };
export const QUESTION_KINDS = ["vocabulary", "grammar", "cloze", "wordBank", "discourse", "reading"] as const;
export type QuestionKind = typeof QUESTION_KINDS[number];
export type JobKind = QuestionKind | "words" | "organizeText" | "organizeImage" | "explain";
export interface QuestionSource { ref: string; word: string; pos: string; meaningZh: string; knownExample?: string }
export interface GenerationInput {
  kind: JobKind;
  raw?: string;
  sources?: QuestionSource[];
  difficulty?: 1 | 2 | 3;
}
export interface GenerationRequest extends GenerationInput {
  session: string;
  tier: Tier;
  cursor?: string;
  repair?: string;
}
export interface AccountInfo {
  points: number;
  monthly: number;
  renews_at: number | null;
  tiers: Tier[];
  admin: boolean;
}
export interface AdminAccount { uid: string; email: string; points: number; monthly: number; renews_at: number; note: string | null }
export const LIMITS = { input: 5000, source: 200, sources: 30, outputTokens: 8192, imageBytes: 1_500_000, imageEdge: 1800, bodyBytes: 2_200_000 } as const;

/** Rates are half-points so all intermediate arithmetic stays integral. */
export function rate(kind: JobKind, tier: Tier): number {
  if (kind === "organizeImage") return 12;
  if (kind === "organizeText" || kind === "explain") return 10;
  return ({ words: 3, vocabulary: 2, grammar: 2, wordBank: 2, cloze: 4, discourse: 24, reading: 30 }[kind]) * MULTIPLIER[tier];
}
export function estimatePoints(kind: JobKind, count: number, tier: Tier): { min: number; max: number } {
  const max = Math.ceil(rate(kind, tier) * count / 2);
  return { min: kind === "reading" ? count * 9 * MULTIPLIER[tier] : max, max };
}
