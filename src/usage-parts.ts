import { creditsFromUsage } from "./credits";
import type { Usage } from "./billing";

/** Provider calls belonging to one reserved operation; no generated text. */
export interface UsagePart extends Usage {
  cursor?: string;
}

export function completeUsage(part: UsagePart): boolean {
  return [part.input, part.output, part.cached, part.cacheWrite].every(
    (value) => Number.isSafeInteger(value) && Number(value) >= 0,
  ) && Number(part.cached) + Number(part.cacheWrite) <= Number(part.input);
}

export function sumUsage(parts: readonly UsagePart[]): Usage {
  return {
    model: parts[0].model,
    ...Object.fromEntries((["input", "output", "cached", "cacheWrite"] as const)
      .map((field) => [field, parts.reduce((sum, part) => sum + (part[field] ?? 0), 0)])),
  };
}

export function partsCost(parts: readonly UsagePart[]): number | null {
  if (!parts.length || parts.some((part) => !completeUsage(part))) return null;
  const costs = parts.map(creditsFromUsage);
  return costs.some((cost) => cost === null)
    ? null
    : costs.reduce<number>((sum, cost) => sum + cost!, 0);
}
