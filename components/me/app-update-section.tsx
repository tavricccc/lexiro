"use client";

import { useAppUpdateStore } from "@/stores/app-update-store";
import { Icons } from "@/components/ui/icons";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

export function AppUpdateSection() {
  const update = useAppUpdateStore();
  if (!update.check || !update.apply) return null;
  const busy = update.phase !== null;
  return (
    <ListSection
      className="section-gap"
      footer={
        update.error ? (
          <span role="alert" className="text-destructive">
            {update.error}
          </span>
        ) : !update.online ? (
          t("appUpdate.offline")
        ) : undefined
      }
    >
      <ListRow
        icon={Icons.refresh}
        label={t("appUpdate.title")}
        value={t(
          update.phase === "checking"
            ? "appUpdate.checking"
            : update.available
              ? "appUpdate.available"
              : update.error
                ? "appUpdate.failed"
                : update.checked
                  ? "appUpdate.noneFound"
                  : "appUpdate.idle",
        )}
      />
      <ListActionRow
        busy={busy}
        disabled={busy || !update.online}
        onClick={() =>
          void (update.available ? update.apply!() : update.check!())
        }
      >
        {t(
          update.phase === "saving"
            ? "appUpdate.saving"
            : update.phase === "restarting"
              ? "appUpdate.restarting"
              : update.phase === "checking"
                ? "appUpdate.checking"
                : update.available
                  ? "appUpdate.restart"
                  : "appUpdate.check",
        )}
      </ListActionRow>
    </ListSection>
  );
}
