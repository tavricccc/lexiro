"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ListActionRow, ListSection } from "@/components/ui/list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  createFullBackup,
  downloadFullBackup,
  prepareBackupImport,
  readFullBackup,
  type PreparedBackupImport,
} from "@/src/lib/full-backup";

export function DataSection() {
  const library = useLibraryStore();
  const learning = useLearningStore();
  const [pending, setPending] = useState<PreparedBackupImport | null>(null);

  const exportBackup = () => {
    const backup = createFullBackup(
      library.state,
      learning.progress,
      learning.stats,
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
    setPending(null);
    toast.success(t("settings.importDone"));
  };

  return (
    <>
      <ListSection
        footer={`${t("me.dataDescription")} ${t("me.backupHint")}`}
        header={t("settings.data")}
      >
        <ListActionRow onClick={exportBackup}>
          {t("settings.export")}
        </ListActionRow>
        {/* Reading a file needs a real input; the row is its label so the
            whole row opens the picker, the way every other row works. */}
        <label className="t-row flex min-h-11 w-full cursor-pointer items-center justify-center py-2.5 text-center type-row text-primary">
          {t("settings.import")}
          <input
            accept=".zip,application/zip"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </ListSection>

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
        tone="default"
        onConfirm={confirmImport}
      />
    </>
  );
}
