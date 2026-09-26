"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminIssue, type AdminSettingsValue } from "./admin-shared";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { StepActions } from "@/components/ui/step-actions";
import {
  ListInputRow,
  ListRow,
  ListSection,
  ListSwitchRow,
} from "@/components/ui/list";
import { managedJson } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

interface AdminSettingsDraft {
  freeTrial: boolean;
  defaultInitial: string;
  defaultMonthly: string;
}

export function AdminSettings() {
  const uid = useCloudStore((store) => store.user?.uid);
  const settings = useQuery({
    queryKey: ["admin-settings", uid],
    queryFn: () => managedJson<AdminSettingsValue>("/admin/settings"),
    retry: false,
  });
  if (settings.error)
    return (
      <AdminIssue
        message={settings.error.message}
        onRetry={() => void settings.refetch()}
      />
    );
  if (!settings.data)
    return (
      <ListSection>
        <ListRow label={t("common.loading")} />
      </ListSection>
    );

  const revision = `${settings.data.freeTrial}:${settings.data.defaultInitial}:${settings.data.defaultMonthly}`;
  return (
    <AdminSettingsForm
      key={`${uid}:${revision}`}
      uid={uid}
      revision={revision}
      initial={settings.data}
    />
  );
}

function AdminSettingsForm({
  uid,
  revision,
  initial,
}: {
  uid: string | undefined;
  revision: string;
  initial: AdminSettingsValue;
}) {
  const client = useQueryClient();
  const saved = useResumableDraft<AdminSettingsDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:admin-settings:${revision}`,
    {
      freeTrial: initial.freeTrial,
      defaultInitial: String(initial.defaultInitial),
      defaultMonthly: String(initial.defaultMonthly),
    },
  );
  const draft = saved.draft;
  const [busy, setBusy] = useState(false);
  if (saved.status === "checking")
    return (
      <ListSection>
        <ListRow label={t("common.loading")} />
      </ListSection>
    );
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.adminSettingsDescription",
        )}
        header={false}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
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
          body: JSON.stringify({
            freeTrial: draft.freeTrial,
            defaultInitial: Number(draft.defaultInitial),
            defaultMonthly: Number(draft.defaultMonthly),
          } satisfies AdminSettingsValue),
        })
          .then(async () => {
            saved.clear();
            await client.invalidateQueries({
              queryKey: ["admin-settings", uid],
            });
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
      <DraftSaveStatus status={saved.persistence} />
      <ListSection footer={t("admin.trialHint")}>
        <ListSwitchRow
          checked={draft.freeTrial}
          disabled={busy}
          label={t("admin.trial")}
          onCheckedChange={(freeTrial) => saved.update({ freeTrial })}
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
          onChange={(defaultInitial) => saved.update({ defaultInitial })}
          required
          type="number"
          value={draft.defaultInitial}
        />
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.defaultMonthly")}
          max={1_000_000}
          min={0}
          onChange={(defaultMonthly) => saved.update({ defaultMonthly })}
          required
          type="number"
          value={draft.defaultMonthly}
        />
      </ListSection>
      <StepActions>
        <Button
          className="w-full"
          disabled={busy}
          form="admin-settings-form"
          size="lg"
          type="submit"
        >
          <Icons.success />
          {t(busy ? "admin.saving" : "admin.saveSettings")}
        </Button>
      </StepActions>
    </form>
  );
}
