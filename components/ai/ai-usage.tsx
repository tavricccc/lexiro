import type { AiUsage as Usage } from "@/src/types/ai";
import { t } from "@/lib/i18n";

export function AiUsage({
  usage,
  model,
  notices,
}: {
  usage: Usage;
  model: string;
  notices: string[];
}) {
  const entries = [
    ["ai.inputTokens", usage.inputTokens],
    ["ai.outputTokens", usage.outputTokens],
    ["ai.cacheRead", usage.cacheReadTokens],
    ["ai.cacheWrite", usage.cacheWriteTokens],
  ] as const;
  return (
    <details className="rule-t px-4 py-3 sm:px-5">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {t("ai.usageTitle")}
      </summary>
      <p className="mt-3 break-all text-xs font-medium">{model}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-[var(--surface-inset)] p-3">
            <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {value === undefined
                ? t("ai.notReported")
                : value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {t("ai.usageHint")}
      </p>
      {Array.from(new Set(notices)).map((notice) => (
        <p key={notice} className="mt-2 text-xs leading-5">
          {notice}
        </p>
      ))}
    </details>
  );
}
