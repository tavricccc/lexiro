import { MODEL_PRICES, type TokenUsage } from "@lexiro/ai-contract";

// Private billing basis. The public client receives only estimated or settled
// credit amounts; it does not receive this conversion rule.
const CREDITS_PER_US_DOLLAR = 7_500n;
const PRICE_SCALE = 100n;
const TOKENS_PER_MILLION = 1_000_000n;

export function creditsFromUsage(usage: TokenUsage): number | null {
  const price = usage.model ? MODEL_PRICES[usage.model] : undefined;
  if (!price) return null;
  const input = tokenCount(usage.input);
  const cached = tokenCount(usage.cached);
  const output = tokenCount(usage.output);
  if (input === null || cached === null || output === null) return null;
  const fresh = input > cached ? input - cached : 0n;
  const scaledCost =
    fresh * scaledPrice(price.input) +
    cached * scaledPrice(price.cached) +
    output * scaledPrice(price.output);
  const divisor = PRICE_SCALE * TOKENS_PER_MILLION;
  return Number(
    (scaledCost * CREDITS_PER_US_DOLLAR + divisor - 1n) / divisor,
  );
}

function tokenCount(value: number | undefined): bigint | null {
  if (value === undefined) return 0n;
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return BigInt(value);
}

function scaledPrice(value: number): bigint {
  return BigInt(Math.round(value * Number(PRICE_SCALE)));
}
