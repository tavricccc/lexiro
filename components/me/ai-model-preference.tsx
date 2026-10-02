"use client";
import { AI_MODELS, type AiModel } from "@lexiro/ai-contract";
import { ListPicker, ListSection } from "@/components/ui/list";
import { SaveStatus } from "./save-status";
import { useAutosave } from "./use-autosave";
import { PreferenceRecovery } from "./preference-recovery";
import { parseModelPatch } from "@/src/lib/preference-drafts";
import { useAiPreferencesStore } from "@/stores/ai-preferences-store";
import { t } from "@/lib/i18n";

const MODEL_LABELS: Record<AiModel, string> = {
  "gpt-5.6-luna": "GPT-5.6 Luna",
  "gpt-6-luna": "GPT-6 Luna",
};

export function AiModelPreference() {
  const { preferences, setModel, loaded } = useAiPreferencesStore();
  const autosave = useAutosave(({ model }) => setModel(model), {
    key: "model",
    parse: parseModelPatch,
    delay: 0,
    ready: loaded,
  });
  const recovering =
    autosave.recovery === "offer" || autosave.recovery === "invalid";
  return (
    <ListSection
      header={t("settings.ai")}
      footer={
        <>
          {t("settings.aiModelHint")}
          {autosave.draftError && !recovering && (
            <span className="mt-2 block" role="alert">
              {t("settings.pendingStorageFailed")}
            </span>
          )}
        </>
      }
      headerAction={
        <SaveStatus status={autosave.status} onRetry={autosave.retry} />
      }
    >
      <ListPicker
        disabled={!loaded || autosave.recovery !== "active"}
        label={t("settings.aiModel")}
        value={autosave.value?.model ?? preferences.model}
        onChange={(value) => autosave.update({ model: value as AiModel })}
        options={AI_MODELS.map((model) => ({
          label: MODEL_LABELS[model],
          value: model,
        }))}
      />
      {recovering && (
        <PreferenceRecovery
          invalid={autosave.recovery === "invalid"}
          draftError={autosave.draftError}
          onResume={autosave.retry}
          onDiscard={autosave.discard}
        />
      )}
    </ListSection>
  );
}
