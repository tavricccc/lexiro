"use client";

import { useRef, useState } from "react";
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
  const [reading, setReading] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

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
    setReading(true);
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
    } finally {
      setReading(false);
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    await library.importState(pending.library);
    await learning.importState(pending.progress, pending.stats);
    toast.success(t("settings.importDone"));
  };

  return (
    <>
      <ListSection>
        <ListActionRow disabled={reading} onClick={exportBackup}>
          {t("settings.export")}
        </ListActionRow>
        <ListActionRow
          busy={reading}
          onClick={() => importInput.current?.click()}
        >
          {t(reading ? "settings.readingBackup" : "settings.import")}
        </ListActionRow>
        <input
          accept=".zip,application/zip"
          aria-label={t("settings.import")}
          hidden
          ref={importInput}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.target.value = "";
          }}
          type="file"
        />
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
