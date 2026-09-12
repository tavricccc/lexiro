"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AdminIssue, type AdminSettingsValue } from "./admin-shared";
import { ListActionRow, ListInputRow, ListRow, ListSection, ListSwitchRow } from "@/components/ui/list";
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setSaved(false);
        setError("");
        void managedJson<AdminSettingsValue>("/admin/settings", {
          method: "PATCH",
          body: JSON.stringify(draft),
        })
          .then(async () => {
            await client.invalidateQueries({ queryKey: ["admin-settings", uid] });
            setSaved(true);
          })
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : t("managed.failed")),
          )
          .finally(() => setBusy(false));
      }}
    >
      <ListSection>
        <ListSwitchRow
          checked={draft.freeTrial}
          disabled={busy}
          label={t("admin.trial")}
          onCheckedChange={(freeTrial) => setDraft({ ...draft, freeTrial })}
        />
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.trialPoints")}
          max={1_000_000}
          min={0}
          onChange={(value) => setDraft({ ...draft, trialPoints: Number(value) })}
          required
          type="number"
          value={String(draft.trialPoints)}
        />
      </ListSection>
      <ListSection header={t("admin.newAccountDefaults")}>
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
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <ListSection footer={saved ? t("me.saved") : undefined}>
        <ListActionRow disabled={busy} type="submit">
          {t("admin.saveSettings")}
        </ListActionRow>
      </ListSection>
    </form>
  );
}
