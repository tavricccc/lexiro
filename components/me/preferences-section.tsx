"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MeField, MeSection } from "@/components/me/me-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const saveGoals = async () => {
    await learning.setGoals(clampGoal(wordGoal), clampGoal(questionGoal));
    toast.success(t("me.preferencesSaved"));
  };

  return (
    <MeSection
      icon={SlidersHorizontal}
      title={t("me.preferences")}
      description={t("me.preferencesDescription")}
    >
      <div className="grid gap-5">
        <MeField label={t("settings.theme")}>
          <Select value={theme ?? "system"} onValueChange={setTheme}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t("settings.system")}</SelectItem>
              <SelectItem value="light">{t("settings.light")}</SelectItem>
              <SelectItem value="dark">{t("settings.dark")}</SelectItem>
            </SelectContent>
          </Select>
        </MeField>
        <MeField label={t("settings.dailyWords")}>
          <Input
            type="number"
            min={1}
            max={100}
            value={wordGoal}
            onChange={(event) => setWordGoal(Number(event.target.value))}
          />
        </MeField>
        <MeField label={t("settings.dailyQuestions")}>
          <Input
            type="number"
            min={1}
            max={100}
            value={questionGoal}
            onChange={(event) => setQuestionGoal(Number(event.target.value))}
          />
        </MeField>
        <div className="flex justify-end">
          <Button onClick={() => void saveGoals()}>
            {t("settings.saveGoals")}
          </Button>
        </div>
      </div>
    </MeSection>
  );
}

function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(100, Math.max(1, Math.round(value)));
}
