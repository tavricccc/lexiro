"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function PreferenceRecovery({
  invalid,
  draftError,
  onResume,
  onDiscard,
}: {
  invalid: boolean;
  draftError: boolean;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="space-y-3 p-[var(--row-padding-block)]" role="status">
      <p className="type-row-detail">
        {t(invalid ? "settings.pendingInvalid" : "settings.pendingChanges")}
      </p>
      {draftError && (
        <p className="type-row-detail text-destructive" role="alert">
          {t("settings.pendingStorageFailed")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!invalid && (
          <Button onClick={onResume}>{t("settings.applyPending")}</Button>
        )}
        <Button variant="outline" onClick={onDiscard}>
          {t("settings.keepCurrent")}
        </Button>
      </div>
    </div>
  );
}
