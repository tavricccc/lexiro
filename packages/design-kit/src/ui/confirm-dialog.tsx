import * as React from "react";
import { AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@ui-sdk/react/alert-dialog";
import { useLabels } from "../lib/provider";
import { cn } from "../lib/utils";
import { Button, buttonVariants, type ActionStatus } from "./button";
import { backdropClass, centeredClass } from "./dialog";

/**
 * A question answered before something irreversible. It stays open while the
 * action runs so a failure can be retried in place.
 */
export function ConfirmDialog({ cancelLabel, children, confirmLabel, description, onConfirm, onOpenChange, open, status = "idle", title, tone = "default", trigger }: {
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
      onOpenChange={(next, details) => { if (busy) details.cancel(); else onOpenChange?.(next); }}
      open={open}
    >
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogBackdrop className={backdropClass} />
      <AlertDialogContent className={cn(centeredClass, "w-[min(24rem,calc(100vw-2rem))]")}>
        <div className="grid gap-2">
          <AlertDialogTitle className="text-xl font-extrabold">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</AlertDialogDescription> : null}
        </div>
        {children}
        <div className="grid grid-cols-2 gap-3">
          <AlertDialogClose className={buttonVariants({ variant: "secondary" })} disabled={busy}>{cancelLabel ?? labels.cancel}</AlertDialogClose>
          <Button onClick={onConfirm} status={status} variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
