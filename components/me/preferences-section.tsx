"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { SaveStatus } from "@/components/me/save-status";
import { useAutosave } from "@/components/me/use-autosave";
import {
  ListChoiceRow,
  ListNavRow,
  ListSection,
  ListStepperRow,
} from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";

const THEMES = ["system", "light", "dark"] as const;
const THEME_LABEL = {
  system: "settings.system",
  light: "settings.light",
  dark: "settings.dark",
} as const;

export function PreferencesSection() {
  const learning = useLearningStore();
  const { theme, setTheme } = useTheme();
  const [wordGoal, setWordGoal] = useState(learning.stats.dailyWordGoal);
  const [questionGoal, setQuestionGoal] = useState(
    learning.stats.dailyQuestionGoal,
  );
  // The theme's options open under their own row instead of in a dropdown: a
  // list of three that is already on screen beats a menu that covers it.
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    if (!learning.loaded) return;
    setWordGoal(learning.stats.dailyWordGoal);
    setQuestionGoal(learning.stats.dailyQuestionGoal);
  }, [
    learning.loaded,
    learning.stats.dailyQuestionGoal,
    learning.stats.dailyWordGoal,
  ]);

  const goals = useMemo(
    () => ({ questionGoal, wordGoal }),
    [questionGoal, wordGoal],
  );
  const status = useAutosave(
    goals,
    (value) =>
      learning.setGoals(
        clampGoal(value.wordGoal),
        clampGoal(value.questionGoal),
      ),
    { ready: learning.loaded },
  );
  const current = (THEMES as readonly string[]).includes(theme ?? "")
    ? (theme as (typeof THEMES)[number])
    : "system";

  return (
    <ListSection
      footer={t("me.preferencesDescription")}
      header={t("me.preferences")}
      headerAction={<SaveStatus status={status} />}
    >
      <ListNavRow
        expanded={themeOpen}
        label={t("settings.theme")}
        onClick={() => setThemeOpen(!themeOpen)}
        value={t(THEME_LABEL[current])}
      />
      {themeOpen &&
        THEMES.map((value) => (
          <ListChoiceRow
            key={value}
            label={t(THEME_LABEL[value])}
            onSelect={() => {
              setTheme(value);
              setThemeOpen(false);
            }}
            selected={current === value}
          />
        ))}
      <ListStepperRow
        label={t("settings.dailyWords")}
        max={100}
        min={1}
        onChange={setWordGoal}
        value={wordGoal}
      />
      <ListStepperRow
        label={t("settings.dailyQuestions")}
        max={100}
        min={1}
        onChange={setQuestionGoal}
        value={questionGoal}
      />
    </ListSection>
  );
}

function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(100, Math.max(1, Math.round(value)));
}
