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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-[0_22px_60px_rgb(18_40_34/0.24)] outline-none">
          <div className="grid size-11 place-items-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"><AlertTriangle className="size-5" /></div>
          <Dialog.Title className="mt-4 text-xl font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-ink-muted">{description}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild><Button type="button" variant="ghost" disabled={busy}>{t("common.cancel")}</Button></Dialog.Close>
            <Button type="button" disabled={busy} className="bg-red-700 shadow-none hover:bg-red-800" onClick={() => void onConfirm()}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
