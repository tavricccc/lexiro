"use client";

import { DatabaseBackup, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MeSection } from "@/components/me/me-section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { saveAiSettings, waitForAiSettingsPersistence } from "@/src/lib/ai-provider";
import {
  createFullBackup,
  downloadFullBackup,
  prepareBackupImport,
  readFullBackup,
  type PreparedBackupImport,
} from "@/src/lib/full-backup";
import type { AiSettings } from "@/types";

export function DataSection({
  aiSettings,
  onAiSettingsChange,
}: {
  aiSettings: AiSettings;
  onAiSettingsChange: (settings: AiSettings) => void;
}) {
  const library = useLibraryStore();
  const learning = useLearningStore();
  const [pending, setPending] = useState<PreparedBackupImport | null>(null);

  const exportBackup = () => {
    const backup = createFullBackup(
      library.state,
      learning.progress,
      learning.stats,
      aiSettings,
    );
    downloadFullBackup(backup);
    toast.success(t("me.backupExported"));
  };

  const importBackup = async (file: File) => {
    try {
      const backup = await readFullBackup(file);
      setPending(
        prepareBackupImport(
          backup,
          library.state,
          learning.progress,
          learning.stats,
        ),
      );
    } catch (reason) {
      toast.error(
        t("settings.invalidBackup", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    await library.importState(pending.library);
    await learning.importState(pending.progress, pending.stats);
    const nextAiSettings = {
      ...pending.aiSettings,
      apiKey: aiSettings.apiKey,
    };
    onAiSettingsChange(nextAiSettings);
    saveAiSettings(nextAiSettings);
    await waitForAiSettingsPersistence();
    setPending(null);
    toast.success(t("settings.importDone"));
  };

  return (
    <>
      <MeSection
        icon={DatabaseBackup}
        title={t("settings.data")}
        description={t("me.dataDescription")}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={exportBackup}>
            <Download className="size-4" />
            {t("settings.export")}
          </Button>
          <Button asChild variant="secondary">
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t("settings.import")}
              <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importBackup(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {t("me.backupHint")}
        </p>
      </MeSection>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t("settings.importTitle")}
        description={
          pending
            ? t("settings.importPreview", {
                sets: pending.sets,
                questions: pending.questions,
                cards: pending.cards,
              })
            : ""
        }
        confirmLabel={t("settings.import")}
        onConfirm={confirmImport}
      />
    </>
  );
}
