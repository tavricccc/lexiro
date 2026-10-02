"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

interface ConfirmDialogProps {
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
  confirmLabel = t("common.confirm"),
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) setError("");
  }, [open]);
  useEffect(() => {
    if (error) confirmButton.current?.focus();
  }, [error]);

  const confirm = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (reason) {
      setError(
        t("common.actionFailed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const danger = tone === "danger";
  const Glyph = danger ? Icons.error : Icons.question;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!running.current) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content
            aria-busy={busy}
            className="t-dialog surface-floating pointer-events-auto relative grid max-h-[calc(100dvh-2rem)] w-full max-w-md gap-5 overflow-y-auto p-6 outline-none sm:p-7"
            onEscapeKeyDown={(event) => {
              if (running.current) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (running.current) event.preventDefault();
            }}
          >
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
              <Dialog.Title className="type-section">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 type-lead">
                {description}
              </Dialog.Description>
            </div>
            {error && (
              <p className="break-words text-sm text-destructive" role="alert">
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
                ref={confirmButton}
                disabled={busy}
                aria-busy={busy}
                onClick={() => void confirm()}
                type="button"
                variant={danger ? "destructive" : "default"}
              >
                {busy && (
                  <ActionFeedbackIcon
                    className="bg-transparent [&>svg]:size-4"
                    size="sm"
                    state="loading"
                  />
                )}
                <span role={busy ? "status" : undefined}>
                  {busy
                    ? t("common.processing")
                    : error
                      ? t("common.retry")
                      : confirmLabel}
                </span>
              </Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
