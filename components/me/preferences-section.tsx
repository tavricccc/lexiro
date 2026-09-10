"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { MeSection } from "@/components/me/me-section";
import { useAutosave } from "@/components/me/use-autosave";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";

export function PreferencesSection() {
  const learning = useLearningStore();
  const { theme, setTheme } = useTheme();
  const [wordGoal, setWordGoal] = useState(learning.stats.dailyWordGoal);
  const [questionGoal, setQuestionGoal] = useState(
    learning.stats.dailyQuestionGoal,
  );

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
      learning.setGoals(clampGoal(value.wordGoal), clampGoal(value.questionGoal)),
    { ready: learning.loaded },
  );

  return (
    <MeSection
      description={t("me.preferencesDescription")}
      icon={Icons.settings}
      status={status}
      title={t("me.preferences")}
    >
      <div className="grid gap-5">
        <SelectField
          label={t("settings.theme")}
          layout="row"
          onValueChange={setTheme}
          options={[
            { label: t("settings.system"), value: "system" },
            { label: t("settings.light"), value: "light" },
            { label: t("settings.dark"), value: "dark" },
          ]}
          value={theme ?? "system"}
        />
        <Field label={t("settings.dailyWords")} layout="row">
          <Input
            max={100}
            min={1}
            onChange={(event) => setWordGoal(Number(event.target.value))}
            type="number"
            value={wordGoal}
          />
        </Field>
        <Field label={t("settings.dailyQuestions")} layout="row">
          <Input
            max={100}
            min={1}
            onChange={(event) => setQuestionGoal(Number(event.target.value))}
            type="number"
            value={questionGoal}
          />
        </Field>
      </div>
    </MeSection>
  );
}

function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(100, Math.max(1, Math.round(value)));
}
