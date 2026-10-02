"use client";
import { useRef, useState } from "react";
import { AI_MODELS, type AiModel } from "@lexiro/ai-contract";
import { ListPicker, ListSection } from "@/components/ui/list";
import { SaveStatus } from "./save-status";
import type { AutosaveStatus } from "./use-autosave";
import { useAiPreferencesStore } from "@/stores/ai-preferences-store";
import { t } from "@/lib/i18n";

const MODEL_LABELS: Record<AiModel, string> = {
  "gpt-5.6-luna": "GPT-5.6 Luna",
  "gpt-6-luna": "GPT-6 Luna",
};

export function AiModelPreference() {
  const { preferences, setModel } = useAiPreferencesStore();
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const requested = useRef(preferences.model);
  const revision = useRef(0);
  const save = async (model: AiModel) => {
    const current = ++revision.current;
    requested.current = model;
    setStatus("saving");
    try {
      await setModel(model);
      if (current === revision.current) setStatus("saved");
    } catch {
      if (current === revision.current) setStatus("error");
    }
  };
  return (
    <ListSection
      header={t("settings.ai")}
      footer={t("settings.aiModelHint")}
      headerAction={
        <SaveStatus
          status={status}
          onRetry={() => void save(requested.current)}
        />
      }
    >
      <ListPicker
        label={t("settings.aiModel")}
        value={preferences.model}
        onChange={(value) => void save(value as AiModel)}
        options={AI_MODELS.map((model) => ({
          label: MODEL_LABELS[model],
          value: model,
        }))}
      />
    </ListSection>
  );
}
