"use client";

import { useQuery } from "@tanstack/react-query";
import { estimateCost } from "@lexiro/ai-contract";

import { formatCost } from "@/components/ai/ai-usage";
import { CreditBadge } from "@/components/ai/credit-badge";
import { AdminIssue, type AdminSettingsValue, type UsageReport } from "./admin-shared";
import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { managedJson } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminPanel() {
  const uid = useCloudStore((store) => store.user?.uid);
  const accounts = useQuery({
    queryKey: ["admin-accounts", uid, 0],
    queryFn: () =>
      managedJson<{ accounts: unknown[]; nextOffset: number | null }>(
        "/admin/accounts?offset=0",
      ),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["admin-settings", uid],
    queryFn: () => managedJson<AdminSettingsValue>("/admin/settings"),
    retry: false,
  });
  const usage = useQuery({
    queryKey: ["admin-usage", uid, 0],
    queryFn: () => managedJson<UsageReport>("/admin/usage?offset=0"),
    retry: false,
  });
  const issue =
    accounts.error?.message || settings.error?.message || usage.error?.message;
  const cost = totalCost(usage.data?.models ?? []);
  const credits = usage.data?.models.reduce(
    (total, model) => total + (model.credits ?? 0),
    0,
  );

  return (
    <div className="space-y-7">
      {issue && (
        <AdminIssue
          message={issue}
          onRetry={() => {
            void accounts.refetch();
            void settings.refetch();
            void usage.refetch();
          }}
        />
      )}
      <ListSection>
        <ListNavRow
          href="/me/admin/accounts"
          icon={Icons.account}
          label={t("admin.accounts")}
          value={
            accounts.data
              ? t("admin.accountsCount", {
                  count: accounts.data.accounts.length,
                })
              : t("common.loading")
          }
        />
        <ListNavRow
          href="/me/admin/usage"
          icon={Icons.stats}
          label={t("admin.usage")}
          value={
            usage.data ? (
              <span className="flex items-center gap-2">
                <span>{formatCost(cost)}</span>
                {credits !== undefined && (
                  <CreditBadge
                    label={t("admin.creditEquivalent", { credits })}
                    value={credits}
                  />
                )}
              </span>
            ) : (
              t("common.loading")
            )
          }
        />
        <ListNavRow
          href="/me/admin/settings"
          icon={Icons.settings}
          label={t("admin.settings")}
          value={
            settings.data
              ? t(settings.data.freeTrial ? "admin.trialOn" : "admin.trialOff")
              : t("common.loading")
          }
        />
      </ListSection>
    </div>
  );
}

function totalCost(
  models: { model: string; input: number; cached: number; cacheWrite: number; output: number }[],
): number | null {
  if (!models.length) return 0;
  let total = 0;
  for (const model of models) {
    const cost = estimateCost(model);
    if (cost === null) return null;
    total += cost;
  }
  return total;
}
