"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminIssue, type AdminSettingsValue } from "./admin-shared";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { ListInputRow, ListRow, ListSection, ListSwitchRow } from "@/components/ui/list";
import { managedJson } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminSettings() {
  const uid = useCloudStore((store) => store.user?.uid);
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["admin-settings", uid],
    queryFn: () => managedJson<AdminSettingsValue>("/admin/settings"),
    retry: false,
  });
  const [draft, setDraft] = useState<AdminSettingsValue | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (settings.error)
    return (
      <AdminIssue
        message={settings.error.message}
        onRetry={() => void settings.refetch()}
      />
    );
  if (!draft)
    return (
      <ListSection>
        <ListRow label={t("common.loading")} />
      </ListSection>
    );

  return (
    <form
      className="space-y-7"
      id="admin-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void managedJson<AdminSettingsValue>("/admin/settings", {
          method: "PATCH",
          body: JSON.stringify(draft),
        })
          .then(async () => {
            await client.invalidateQueries({ queryKey: ["admin-settings", uid] });
            toast.success(t("admin.settingsSaved"));
          })
          .catch((reason: unknown) =>
            toast.error(
              reason instanceof Error ? reason.message : t("managed.failed"),
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      <ListSection footer={t("admin.trialHint")}>
        <ListSwitchRow
          checked={draft.freeTrial}
          disabled={busy}
          label={t("admin.trial")}
          onCheckedChange={(freeTrial) => setDraft({ ...draft, freeTrial })}
        />
      </ListSection>
      <ListSection
        footer={t("admin.newAccountHint")}
        header={t("admin.newAccountDefaults")}
      >
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.defaultInitial")}
          max={1_000_000}
          min={0}
          onChange={(value) => setDraft({ ...draft, defaultInitial: Number(value) })}
          required
          type="number"
          value={String(draft.defaultInitial)}
        />
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.defaultMonthly")}
          max={1_000_000}
          min={0}
          onChange={(value) => setDraft({ ...draft, defaultMonthly: Number(value) })}
          required
          type="number"
          value={String(draft.defaultMonthly)}
        />
      </ListSection>
      <StepActions>
        <Button className="w-full" disabled={busy} form="admin-settings-form" size="lg" type="submit">
          <Icons.success />
          {t(busy ? "admin.saving" : "admin.saveSettings")}
        </Button>
      </StepActions>
    </form>
  );
}
