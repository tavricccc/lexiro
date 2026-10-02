"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ListActionRow, ListSection } from "@/components/ui/list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { importFullBackup, prepareFullBackup } from "@/lib/backup-actions";
import { getStorageNamespace } from "@/src/lib/persist";
import type { FullBackupPayload } from "@/types";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  downloadFullBackup,
  previewBackupImport,
  readFullBackup,
  type BackupImportPreview,
} from "@/src/lib/full-backup";

export function DataSection() {
  const library = useLibraryStore();
  const learning = useLearningStore();
  const [pending, setPending] = useState<{
    backup: FullBackupPayload;
    namespace: string;
  } | null>(null);
  const [operation, setOperation] = useState<
    "reading" | "exporting" | "importing" | null
  >(null);
  const [reviewed, setReviewed] = useState<BackupImportPreview | null>(null);
  const working = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () =>
      pending
        ? previewBackupImport(pending.backup, library.state, learning.progress)
        : null,
    [pending, library.state, learning.progress],
  );
  const displayed = operation === "importing" ? reviewed : preview;
  const accountChanged =
    pending !== null && pending.namespace !== getStorageNamespace();

  const exportBackup = async () => {
    if (working.current) return;
    working.current = true;
    setOperation("exporting");
    try {
      const backup = await prepareFullBackup(getStorageNamespace());
      downloadFullBackup(backup);
      toast.success(t("me.backupExported"));
    } catch (reason) {
      toast.error(
        t("settings.exportFailed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    } finally {
      working.current = false;
      setOperation(null);
    }
  };

  const importBackup = async (file: File) => {
    if (working.current) return;
    working.current = true;
    setOperation("reading");
    const namespace = getStorageNamespace();
    try {
      const backup = await readFullBackup(file);
      if (namespace !== getStorageNamespace()) {
        toast.error(t("settings.backupAccountChanged"));
        return;
      }
      setPending({ backup, namespace });
    } catch (reason) {
      toast.error(
        t("settings.invalidBackup", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    } finally {
      working.current = false;
      setOperation(null);
    }
  };

  const confirmImport = async () => {
    if (!pending || working.current) return;
    working.current = true;
    setReviewed(preview);
    setOperation("importing");
    try {
      await importFullBackup(pending.backup, pending.namespace);
      toast.success(t("settings.importDone"));
    } finally {
      working.current = false;
      setOperation(null);
      setReviewed(null);
    }
  };

  return (
    <>
      <ListSection>
        <ListActionRow
          busy={operation === "exporting"}
          disabled={operation !== null}
          onClick={() => void exportBackup()}
        >
          {t(
            operation === "exporting"
              ? "settings.exportingBackup"
              : "settings.export",
          )}
        </ListActionRow>
        <ListActionRow
          busy={operation === "reading"}
          disabled={operation !== null}
          onClick={() => importInput.current?.click()}
        >
          {t(
            operation === "reading"
              ? "settings.readingBackup"
              : "settings.import",
          )}
        </ListActionRow>
        <input
          accept=".zip,application/zip"
          aria-label={t("settings.import")}
          hidden
          disabled={operation !== null}
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
          displayed
            ? t("settings.importPreview", {
                sets: displayed.sets,
                questions: displayed.questions,
                cards: displayed.cards,
              })
            : ""
        }
        confirmLabel={t("settings.import")}
        tone="default"
        onConfirm={confirmImport}
        onRetry={
          accountChanged
            ? () => {
                setPending(null);
                importInput.current?.click();
              }
            : undefined
        }
        retryLabel={
          accountChanged ? t("settings.chooseBackupAgain") : undefined
        }
      />
    </>
  );
}
