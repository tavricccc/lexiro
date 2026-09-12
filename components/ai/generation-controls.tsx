"use client";
import { estimatePoints, TIERS, type JobKind, type Tier } from "@lexiro/ai-contract";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useManagedAccount } from "./use-managed-account";

export function GenerationControls({ kind, count, tier, onTierChange, disabled = false }: { kind: JobKind; count: number; tier: Tier; onTierChange: (tier: Tier) => void; disabled?: boolean }) {
  const account = useManagedAccount();
  const estimate = estimatePoints(kind, count, tier);
  return <div className="grid gap-3">
    <SelectField label={t("managed.tier")} value={tier} disabled={disabled} onValueChange={(value) => onTierChange(value as Tier)} options={TIERS.map((value) => ({ value, label: t(`managed.${value}`) }))} />
    <p className="text-xs text-muted-foreground">{t(`managed.${tier}Hint`)}</p>
    <div className="flex flex-wrap justify-between gap-2 text-sm tabular-nums" aria-live="polite">
      <span>{estimate.min === estimate.max ? t("managed.estimate", { points: estimate.max }) : t("managed.estimateRange", estimate)}</span>
      {account.data && <span>{t("managed.balance", { points: account.data.points })}</span>}
    </div>
    {account.error && <div role="alert" className="text-sm text-destructive">{account.error.message}<Button type="button" variant="ghost" size="sm" onClick={() => void account.refetch()}>{t("common.reload")}</Button></div>}
  </div>;
}
