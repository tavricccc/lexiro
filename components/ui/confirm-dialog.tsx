"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = t("common.confirm"), busy = false, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content className="t-dialog surface-floating pointer-events-auto relative grid w-full max-w-md gap-5 p-6 outline-none sm:p-7">
            <div className="grid size-12 place-items-center rounded-md bg-muted"><AlertTriangle className="size-6 text-muted-foreground" /></div>
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">{description}</Dialog.Description>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild><Button type="button" variant="outline" disabled={busy}>{t("common.cancel")}</Button></Dialog.Close>
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void onConfirm()}>{confirmLabel}</Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
