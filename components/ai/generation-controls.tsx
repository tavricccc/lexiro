"use client";
import {
  estimatePoints,
  TIERS,
  type JobKind,
  type Tier,
} from "@lexiro/ai-contract";
import { ListChoiceRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { useManagedAccount } from "./use-managed-account";

/**
 * Choosing how hard the model should think.
 *
 * This was a dropdown with the price on a line underneath it, which meant the
 * one number that decides the choice was never next to the thing it was the
 * price of. Three options are a list: each row says what the tier is for and
 * what this particular run will cost on it, and the balance sits under the
 * group as the sentence that limits all three.
 */
export function GenerationControls({
  count,
  disabled = false,
  kind,
  onTierChange,
  tier,
}: {
  count: number;
  disabled?: boolean;
  kind: JobKind;
  onTierChange: (tier: Tier) => void;
  tier: Tier;
}) {
  const account = useManagedAccount();
  // An administrator is not spending points, so the rows say what the tier is
  // for and nothing else; the tokens arrive once the run has run.
  const admin = account.data?.admin === true;
  return (
    <ListSection
      footer={
        account.error
          ? account.error.message
          : admin
            ? t("admin.unlimited")
            : account.data
              ? t("managed.balance", { points: account.data.points })
              : undefined
      }
      header={t("managed.tier")}
    >
      {TIERS.map((value) => {
        const estimate = estimatePoints(kind, count, value);
        return (
          <ListChoiceRow
            detail={t(`managed.${value}Hint`)}
            disabled={disabled}
            key={value}
            label={t(`managed.${value}`)}
            onSelect={() => onTierChange(value)}
            selected={tier === value}
            value={
              admin || !count
                ? undefined
                : estimate.min === estimate.max
                  ? t("managed.points", { points: estimate.max })
                  : t("managed.pointsRange", estimate)
            }
          />
        );
      })}
    </ListSection>
  );
}
