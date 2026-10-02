"use client";

import type { AutosaveStatus } from "@/components/me/use-autosave";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * One quiet line per group, with an explicit retry when persistence fails.
 */
export function SaveStatus({
  status,
  onRetry,
}: {
  status: AutosaveStatus;
  onRetry: () => void;
}) {
  if (status === "error")
    return (
      <button
        aria-live="polite"
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-destructive underline underline-offset-4"
      >
        <Icons.retry className="size-4" />
        {t("me.saveFailedRetry")}
      </button>
    );
  return (
    <p
      aria-live="polite"
      className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-[var(--motion-control)]"
      style={{ opacity: status === "idle" ? 0 : 1 }}
    >
      {status === "saved" && (
        <Icons.success aria-hidden className="size-3.5 text-success" />
      )}
      {status === "idle"
        ? ""
        : t(status === "saved" ? "me.saved" : "me.saving")}
    </p>
  );
}
