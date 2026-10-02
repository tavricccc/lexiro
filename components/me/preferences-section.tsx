"use client";

import { useTheme } from "next-themes";

import { SaveStatus } from "@/components/me/save-status";
import { useAutosave } from "@/components/me/use-autosave";
import { ListPicker, ListSection, ListStepperRow } from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { getStorageNamespace } from "@/src/lib/persist";
import { parseGoalPatch } from "@/src/lib/preference-drafts";
import { AiModelPreference } from "./ai-model-preference";
import { PreferenceRecovery } from "./preference-recovery";

const THEMES = ["system", "light", "dark"] as const;
const THEME_LABEL = {
  system: "settings.system",
  light: "settings.light",
  dark: "settings.dark",
} as const;

export function PreferencesSection() {
  // Namespace hydration notifies this wrapper; pending edits never change owners.
  useLearningStore();
  return <PreferenceGroups key={getStorageNamespace()} />;
}

function PreferenceGroups() {
  const learning = useLearningStore();
  const { theme, setTheme } = useTheme();
  const autosave = useAutosave(learning.setGoals, {
    key: "goals",
    parse: parseGoalPatch,
    ready: learning.loaded,
  });
  const recovering =
    autosave.recovery === "offer" || autosave.recovery === "invalid";
  const disabled = !learning.loaded || autosave.recovery !== "active";
  const current = (THEMES as readonly string[]).includes(theme ?? "")
    ? (theme as (typeof THEMES)[number])
    : "system";

  return (
    <div className="space-y-[var(--section-gap)]">
      <ListSection header={t("settings.appearance")}>
        <ListPicker
          label={t("settings.theme")}
          onChange={setTheme}
          options={THEMES.map((value) => ({
            label: t(THEME_LABEL[value]),
            value,
          }))}
          value={current}
        />
      </ListSection>
      <AiModelPreference />
      <ListSection
        header={t("settings.learning")}
        footer={
          autosave.draftError && !recovering ? (
            <span role="alert">{t("settings.pendingStorageFailed")}</span>
          ) : undefined
        }
        headerAction={
          <SaveStatus status={autosave.status} onRetry={autosave.retry} />
        }
      >
        <ListStepperRow
          disabled={disabled}
          label={t("settings.dailyWords")}
          max={100}
          min={1}
          onChange={(dailyWordGoal) => autosave.update({ dailyWordGoal })}
          value={autosave.value?.dailyWordGoal ?? learning.stats.dailyWordGoal}
        />
        <ListStepperRow
          disabled={disabled}
          label={t("settings.dailyQuestions")}
          max={100}
          min={1}
          onChange={(dailyQuestionGoal) =>
            autosave.update({ dailyQuestionGoal })
          }
          value={
            autosave.value?.dailyQuestionGoal ??
            learning.stats.dailyQuestionGoal
          }
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
    </div>
  );
}
