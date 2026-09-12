"use client";

import { estimateCost } from "@lexiro/ai-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { formatCost } from "@/components/ai/ai-usage";
import { CreditBadge } from "@/components/ai/credit-badge";
import { AdminIssue, AdminPager, type UsageReport } from "./admin-shared";
import { ListRow, ListSection } from "@/components/ui/list";
import { managedJson } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminUsage() {
  const uid = useCloudStore((store) => store.user?.uid);
  const [offset, setOffset] = useState(0);
  const usage = useQuery({
    queryKey: ["admin-usage", uid, offset],
    queryFn: () => managedJson<UsageReport>(`/admin/usage?offset=${offset}`),
    retry: false,
  });
  if (usage.error)
    return (
      <AdminIssue
        message={usage.error.message}
        onRetry={() => void usage.refetch()}
      />
    );
  return (
    <div className="space-y-7">
      <ListSection footer={t("admin.spentWindow")} header={t("admin.lastThirtyDays")}>
        {usage.isPending && <ListRow label={t("common.loading")} />}
        {usage.data?.models.map((model) => (
          <ListRow
            detail={t("admin.modelTotals", {
              runs: model.runs,
              tokens: (model.input + model.output).toLocaleString(),
            })}
            key={model.model}
            label={model.model}
            value={
              <UsageValue
                cost={estimateCost({
                  model: model.model,
                  input: model.input,
                  cached: model.cached,
                  output: model.output,
                })}
                credits={model.credits}
              />
            }
          />
        ))}
        {usage.data?.models.length === 0 && (
          <ListRow label={t("admin.noUsage")} />
        )}
      </ListSection>
      {usage.data && usage.data.entries.length > 0 && (
        <ListSection header={t("admin.recentRuns")}>
          {usage.data.entries.map((entry) => (
            <ListRow
              detail={t("admin.runTotals", {
                input: (entry.input ?? 0).toLocaleString(),
                cached: (entry.cached ?? 0).toLocaleString(),
                output: (entry.output ?? 0).toLocaleString(),
              })}
              key={entry.id}
              label={entry.email ?? entry.uid}
              value={
                <UsageValue
                  cost={estimateCost({
                    model: entry.model,
                    input: entry.input ?? 0,
                    cached: entry.cached ?? 0,
                    output: entry.output ?? 0,
                  })}
                  credits={entry.credits}
                />
              }
            />
          ))}
        </ListSection>
      )}
      <AdminPager
        hasNext={usage.data?.nextOffset != null}
        hasPrevious={offset > 0}
        onNext={() => setOffset(usage.data!.nextOffset!)}
        onPrevious={() => setOffset(Math.max(0, offset - 50))}
      />
    </div>
  );
}

function UsageValue({
  cost,
  credits,
}: {
  cost: number | null;
  credits: number | null;
}) {
  return (
    <span className="flex flex-col items-end gap-1.5">
      <span>{formatCost(cost)}</span>
      {credits !== null && (
        <CreditBadge
          label={t("admin.creditEquivalent", { credits })}
          value={credits}
        />
      )}
    </span>
  );
}
