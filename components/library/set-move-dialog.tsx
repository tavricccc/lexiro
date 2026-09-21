"use client";

import type { VocabFolder } from "@/types";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";

import { buildSetFolderOptions } from "@/components/library/set-folder-picker";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";

export function SetMoveDialog({
  currentFolderId,
  folders,
  onMove,
  onOpenChange,
  open,
  setName,
}: {
  currentFolderId: string;
  folders: VocabFolder[];
  onMove: (folderId: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  setName: string;
}) {
  const [folderId, setFolderId] = useState(currentFolderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFolderId(currentFolderId);
      setError("");
    }
  }, [currentFolderId, open]);

  const move = async () => {
    setBusy(true);
    try {
      await onMove(folderId);
      onOpenChange(false);
    } catch {
      setError(t("library.moveSetFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content className="t-dialog surface-floating pointer-events-auto relative grid w-full max-w-md gap-5 p-6 outline-none sm:p-7">
            <div className="grid size-11 place-items-center rounded-md bg-brand-50 text-brand-600">
              <Icons.folder aria-hidden className="size-5" />
            </div>
            <div>
              <Dialog.Title className="type-section">
                {t("library.moveSet")}
              </Dialog.Title>
              <Dialog.Description className="mt-2 type-lead">
                {t("library.moveSetDescription", { name: setName })}
              </Dialog.Description>
            </div>
            <SelectField
              disabled={busy}
              label={t("setEditor.folder")}
              onValueChange={setFolderId}
              options={buildSetFolderOptions(folders)}
              value={folderId}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button disabled={busy} type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                disabled={busy || folderId === currentFolderId}
                onClick={() => void move()}
                type="button"
              >
                <Icons.success />
                {t("library.moveSet")}
              </Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
