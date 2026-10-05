"use client";
import {
  estimatePoints,
  AI_MODELS,
  TIERS,
  type JobKind,
  type Tier,
  type AiModel,
} from "@lexiro/ai-contract";
import { ListChoiceGroup, ListPicker, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { CreditBadge } from "./credit-badge";
import { useManagedAccount } from "./use-managed-account";
import { useAiPreferencesStore } from "@/stores/ai-preferences-store";

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
  model: requestedModel,
  onModelChange,
}: {
  count: number;
  disabled?: boolean;
  kind: JobKind;
  onTierChange: (tier: Tier) => void;
  tier: Tier;
  model?: AiModel;
  onModelChange?: (model: AiModel) => void;
}) {
  const account = useManagedAccount();
  const preferredModel = useAiPreferencesStore(
    (store) => store.preferences.model,
  );
  const model = requestedModel ?? preferredModel;
  // An administrator is not spending points, so the rows say what the tier is
  // for and nothing else; the tokens arrive once the run has run.
  const admin = account.data?.admin === true;
  return (
    <ListSection
      footer={
        <>
          {onModelChange && (
            <span className="mb-1 block">
              {t("managed.organizerModelHint")}
            </span>
          )}
          {account.error
            ? account.error.message
            : admin
              ? t("admin.unlimited")
              : account.data
                ? t("managed.balance", { points: account.data.points })
                : undefined}
        </>
      }
      header={t("managed.tier")}
    >
      {onModelChange && (
        <ListPicker
          disabled={disabled}
          label={t("settings.aiModel")}
          value={model}
          onChange={(value) => onModelChange(value as AiModel)}
          options={AI_MODELS.map((value) => ({
            value,
            label: value === "gpt-6-luna" ? "GPT-6 Luna" : "GPT-5.6 Luna",
          }))}
        />
      )}
      <ListChoiceGroup
        disabled={disabled}
        label={t("managed.tier")}
        onSelect={onTierChange}
        value={tier}
        options={TIERS.map((value) => {
          const estimate = estimatePoints(kind, count, value, model);
          return {
            id: value,
            detail: t(`managed.${value}Hint`),
            label: t(`managed.${value}`),
            value:
              admin || !count ? undefined : (
                <CreditBadge
                  label={
                    estimate.min === estimate.max
                      ? t("managed.expectedPoints", { points: estimate.max })
                      : t("managed.expectedPointsRange", estimate)
                  }
                  value={
                    estimate.min === estimate.max
                      ? t("managed.expectedShort", { points: estimate.max })
                      : t("managed.expectedRangeShort", estimate)
                  }
                />
              ),
          };
        })}
      />
    </ListSection>
  );
}
