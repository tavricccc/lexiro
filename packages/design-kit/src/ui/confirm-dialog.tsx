import * as React from "react";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { useLabels } from "../lib/provider";
import { Button, type ActionStatus } from "./button";

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  status = "idle",
  title,
  tone = "default",
  trigger,
}: {
  cancelLabel?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  description?: React.ReactNode;
  onConfirm: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  status?: ActionStatus;
  title: React.ReactNode;
  tone?: "default" | "danger";
  trigger?: React.ReactElement;
}) {
  const labels = useLabels();
  const busy = status !== "idle";
  return (
    <AlertDialog
      dismissible={!busy}
      onOpenChange={(next) => {
        if (!busy) onOpenChange?.(next);
      }}
      open={open}
    >
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogBackdrop className="fixed inset-0 z-50 bg-[var(--scrim)] transition-opacity duration-[var(--motion-nav)] data-starting-style:opacity-0 data-ending-style:opacity-0" />
      <AlertDialogContent className="fixed left-1/2 top-1/2 z-50 grid w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-none border-2 border-line-strong bg-surface-solid p-6 text-ink shadow-float outline-none transition-[opacity,scale] duration-[var(--motion-control)] data-starting-style:opacity-0 data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:scale-[0.98]">
        <div className="grid gap-2 border-b border-line pb-4">
          <AlertDialogTitle className="text-xl font-bold tracking-[-0.02em]">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</AlertDialogDescription> : null}
        </div>
        {children}
        <div className="grid grid-cols-2 gap-2">
          <AlertDialogClose render={<Button disabled={busy} />}>
            {cancelLabel ?? labels.cancel}
          </AlertDialogClose>
          <Button
            data-agent-confirm={typeof title === "string" ? title : confirmLabel}
            onClick={onConfirm}
            status={status}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
