"use client";

import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

interface ConfirmDialogProps {
  busy?: boolean;
  confirmLabel?: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  tone?: "danger" | "default";
}

/**
 * `tone` decides how loud the dialog is. Deleting a folder is destructive and
 * says so; leaving an editor with unsaved changes is a fork in the road, and
 * dressing it in the same red warning triangle taught people to click through
 * the warning that actually mattered.
 */
export function ConfirmDialog({
  busy = false,
  confirmLabel = t("common.confirm"),
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  const danger = tone === "danger";
  const Glyph = danger ? Icons.error : Icons.question;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content className="t-dialog surface-floating pointer-events-auto relative grid w-full max-w-md gap-5 p-6 outline-none sm:p-7">
            <div
              className={
                danger
                  ? "grid size-11 place-items-center rounded-md bg-destructive/10 text-destructive"
                  : "grid size-11 place-items-center rounded-md bg-brand-50 text-brand-600"
              }
            >
              <Glyph aria-hidden className="size-5" />
            </div>
            <div>
              <Dialog.Title className="font-lexical text-xl font-medium">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button disabled={busy} type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                disabled={busy}
                onClick={() => void onConfirm()}
                type="button"
                variant={danger ? "destructive" : "default"}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
