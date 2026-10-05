import { LONG_CONTEXT_INPUT_THRESHOLD, MODEL_PRICES, LONG_CONTEXT_MODELS, type TokenUsage } from "@lexiro/ai-contract";

// Private billing basis. The public client receives only estimated or settled
// credit amounts; it does not receive this conversion rule.
const CREDITS_PER_US_DOLLAR = 7_500n;
const PRICE_SCALE = 10_000n;
const TOKENS_PER_MILLION = 1_000_000n;

export function creditsFromUsage(usage: TokenUsage): number | null {
  const price = usage.model ? MODEL_PRICES[usage.model] : undefined;
  if (!price) return null;
  const input = tokenCount(usage.input);
  const cached = tokenCount(usage.cached);
  const cacheWrite = tokenCount(usage.cacheWrite);
  const output = tokenCount(usage.output);
  if (
    input === null ||
    cached === null ||
    cacheWrite === null ||
    output === null
  )
    return null;
  const accounted = cached + cacheWrite;
  if (accounted > input) return null;
  const fresh = input - accounted;
  const scaledInput =
    fresh * scaledPrice(price.input) +
    cached * scaledPrice(price.cached) +
    cacheWrite * scaledPrice(price.cacheWrite);
  const scaledOutput = output * scaledPrice(price.output);
  const longContext =
    LONG_CONTEXT_MODELS.includes(usage.model!) && input > BigInt(LONG_CONTEXT_INPUT_THRESHOLD);
  const scaledCostTwice =
    scaledInput * (longContext ? 4n : 2n) +
    scaledOutput * (longContext ? 3n : 2n);
  const divisor = 2n * PRICE_SCALE * TOKENS_PER_MILLION;
  const credits = Number((scaledCostTwice * CREDITS_PER_US_DOLLAR + divisor - 1n) / divisor);
  return Number.isSafeInteger(credits) ? credits : null;
}

function tokenCount(value: number | undefined): bigint | null {
  if (value === undefined) return 0n;
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return BigInt(value);
}

function scaledPrice(value: number): bigint {
  return BigInt(Math.round(value * Number(PRICE_SCALE)));
}
