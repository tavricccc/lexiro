"use client";

import type { AutosaveStatus } from "@/components/me/use-autosave";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * One quiet line per group instead of a save button. It says what happened and
 * then gets out of the way, which is why it never occupies layout space it
 * would have to give back.
 */
export function SaveStatus({ status }: { status: AutosaveStatus }) {
  return (
    <p
      aria-live="polite"
      className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-[var(--motion-control)]"
      style={{ opacity: status === "idle" ? 0 : 1 }}
    >
      {status === "saved" && (
        <Icons.success aria-hidden className="size-3.5 text-success" />
      )}
      {status === "idle" ? "" : t(status === "saved" ? "me.saved" : "me.saving")}
    </p>
  );
}
