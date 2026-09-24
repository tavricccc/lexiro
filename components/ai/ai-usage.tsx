import type { TokenUsage } from "@lexiro/ai-contract";
import { CreditBadge } from "./credit-badge";
import { t } from "@/lib/i18n";

/** Small runs still show their calculated cost below one cent. */
export function formatCost(cost: number | null): string {
  if (cost === null) return t("admin.noPrice");
  return `US$${cost.toFixed(6)}`;
}

export function usageFigures(usage: TokenUsage) {
  const cached = usage.cached ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const input = usage.input ?? 0;
  return [
    ["admin.inputTokens", Math.max(0, input - cached - cacheWrite)],
    ["admin.cacheWriteTokens", cacheWrite],
    ["admin.cachedTokens", cached],
    ["admin.outputTokens", usage.output ?? 0],
    ["admin.reasoningTokens", usage.reasoning ?? 0],
  ] as const;
}

/**
 * What a run actually cost, for the one account that is not spending points.
 *
 * An administrator has no balance to watch, so the number that tells them
 * whether a prompt change was worth it is this one: how much context the model
 * re-read, how much of it came back from cache, and what the provider will
 * charge for it. It replaces the point estimate rather than joining it.
 */
export function AiUsage({ usage }: { usage: TokenUsage }) {
  const input = usage.input ?? 0;
  const cached = usage.cached ?? 0;
  const cost = usage.costUsd ?? null;
  const cacheSavings =
    cost === null || usage.uncachedCostUsd === undefined
      ? null
      : usage.uncachedCostUsd - cost;
  return (
    <div className="rule-card py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium">{t("admin.runUsage")}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium tabular-nums">{formatCost(cost)}</p>
          {usage.credits !== undefined && (
            <CreditBadge
              label={t("admin.creditEquivalent", { credits: usage.credits })}
              value={usage.credits}
            />
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {usageFigures(usage).map(([key, value]) => (
          <div className="rounded-lg bg-[var(--surface-inset)] p-3" key={key}>
            <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      {cacheSavings !== null && (
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {t(
            cacheSavings >= 0 ? "admin.cacheSavings" : "admin.cacheWritePremium",
            { cost: formatCost(Math.abs(cacheSavings)) },
          )}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {usage.model ?? t("admin.noModel")}
        {input > 0 &&
          ` · ${t("admin.cacheHit", { percent: Math.round((cached / input) * 100) })}`}
      </p>
    </div>
  );
}
