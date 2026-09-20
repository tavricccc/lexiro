export * from "./words";
export * from "./formats";

export const TIERS = ["lite", "thinking", "pro"] as const;
export type Tier = (typeof TIERS)[number];
/**
 * What a tier costs relative to lite. Pro is the provider's own ratio: terra
 * lists at exactly ten times luna on both input and output, so eight was
 * charging 80% of what the tier costs to run.
 */
export const MULTIPLIER: Record<Tier, number> = {
  lite: 1,
  thinking: 2,
  pro: 10,
};
export const QUESTION_KINDS = [
  "vocabulary",
  "grammar",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
/**
 * `senses` supplements a word that is already in the Library with meanings it
 * does not have yet. It is priced per word rather than per meaning returned:
 * paying by the meaning would pay a model to pad, which is the one thing the
 * job must not do — returning nothing is a correct answer for most words.
 */
export type JobKind =
  | QuestionKind
  | "words"
  | "senses"
  | "organizeText"
  | "organizeImage"
  | "explain";
export interface QuestionSource {
  ref: string;
  word: string;
  pos: string;
  meaningZh: string;
  knownExample?: string;
}
export interface GenerationInput {
  kind: JobKind;
  raw?: string;
  sources?: QuestionSource[];
  difficulty?: 1 | 2 | 3;
  /** For `senses`, the most meanings one word may gain. Fewer is a valid answer. */
  limit?: 1 | 2 | 3;
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
  /** Administrators run against the provider directly and are never charged. */
  admin: boolean;
}
export interface AdminAccount {
  uid: string;
  email: string;
  points: number;
  monthly: number;
  renews_at: number;
  note: string | null;
}
export interface TokenUsage {
  model?: string;
  input?: number;
  cached?: number;
  cacheWrite?: number;
  output?: number;
  reasoning?: number;
  credits?: number;
}
export interface AdminUsageEntry {
  id: string;
  uid: string;
  email: string | null;
  model: string;
  points: number;
  credits: number | null;
  input: number | null;
  cached: number | null;
  cacheWrite: number | null;
  output: number | null;
  created_at: number;
  status: string;
}
/**
 * One kind of work at one tier, over a month of runs.
 *
 * `credits / units` is cost per billable unit, which is the quantity `rate`
 * names in half-points — so `rate(kind, tier) / 2` beside it says whether the
 * price is above or below what the work costs.
 */
export interface AdminKindUsage {
  kind: JobKind;
  tier: Tier;
  runs: number;
  units: number;
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
  credits: number;
  points: number;
}
/** One account's month of runs on one model: provider cost and points charged. */
export interface AdminUserUsage {
  uid: string;
  email: string | null;
  model: string;
  runs: number;
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
  credits: number;
  points: number;
}
export interface AdminUsageTotals {
  runs: number;
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
  cost: number;
}

/**
 * Published provider list prices in USD per million tokens, as of the 2026-07-30
 * reduction. Cached reads cost 0.1x and GPT-5.6 cache writes cost 1.25x the
 * uncached input rate. Only an administrator sees money, so this is an
 * operating estimate rather than a price anyone is quoted.
 */
export const MODEL_PRICES: Record<
  string,
  { input: number; cached: number; cacheWrite: number; output: number }
> = {
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, cacheWrite: 0.25, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, cacheWrite: 2.5, output: 12 },
};
export function estimateCost(usage: TokenUsage): number | null {
  const price = usage.model ? MODEL_PRICES[usage.model] : undefined;
  if (!price) return null;
  const cached = usage.cached ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const fresh = Math.max(0, (usage.input ?? 0) - cached - cacheWrite);
  return (
    (fresh * price.input +
      cached * price.cached +
      cacheWrite * price.cacheWrite +
      (usage.output ?? 0) * price.output) /
    1_000_000
  );
}
export const LIMITS = {
  input: 5000,
  source: 200,
  sources: 30,
  outputTokens: 8192,
  imageBytes: 1_500_000,
  imageEdge: 1800,
  bodyBytes: 2_200_000,
} as const;

/**
 * Rates are half-points so all intermediate arithmetic stays integral.
 *
 * Calibrated against measured runs, one unit being one source word except for
 * discourse and reading, which are one document however many words went in.
 * The measurement is an upper bound — it prices the whole prompt as uncached
 * and assumes medium reasoning, where lite runs low — so a rate at or below it
 * is charging no more than the run costs.
 */
export function rate(kind: JobKind, tier: Tier): number {
  if (kind === "organizeImage") return 12;
  if (kind === "organizeText" || kind === "explain") return 10;
  return (
    {
      words: 2,
      senses: 2,
      vocabulary: 1,
      grammar: 2,
      wordBank: 2,
      cloze: 3,
      discourse: 24,
      reading: 30,
    }[kind] * MULTIPLIER[tier]
  );
}
export function estimatePoints(
  kind: JobKind,
  count: number,
  tier: Tier,
): { min: number; max: number } {
  const max = Math.ceil((rate(kind, tier) * count) / 2);
  return { min: kind === "reading" ? count * 9 * MULTIPLIER[tier] : max, max };
}
