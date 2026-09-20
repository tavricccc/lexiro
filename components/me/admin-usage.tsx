"use client";

import {
  estimateCost,
  rate,
  type AdminKindUsage,
  type AdminUserUsage,
  type JobKind,
  type Tier,
} from "@lexiro/ai-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { formatCost } from "@/components/ai/ai-usage";
import { CreditBadge } from "@/components/ai/credit-badge";
import { AdminIssue, AdminPager, type UsageReport } from "./admin-shared";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ListRow, ListSection } from "@/components/ui/list";
import { jobKindLabel } from "@/lib/question-options";
import { managedJson } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

/**
 * One account's month, folded across the models it used.
 *
 * Cost is a rate per model, so the report arrives split that way and is only
 * added up here, once each model's own tokens have been priced.
 */
interface AccountSpend {
  uid: string;
  email: string | null;
  runs: number;
  tokens: number;
  points: number;
  cost: number;
  credits: number;
}

function byAccount(rows: readonly AdminUserUsage[]): AccountSpend[] {
  const spend = new Map<string, AccountSpend>();
  for (const row of rows) {
    const current = spend.get(row.uid) ?? {
      uid: row.uid,
      email: row.email,
      runs: 0,
      tokens: 0,
      points: 0,
      cost: 0,
      credits: 0,
    };
    current.runs += row.runs;
    current.tokens += row.input + row.output;
    current.points += row.points;
    current.credits += row.credits;
    current.cost +=
      estimateCost({
        model: row.model,
        input: row.input,
        cached: row.cached,
        cacheWrite: row.cacheWrite,
        output: row.output,
      }) ?? 0;
    spend.set(row.uid, current);
  }
  return [...spend.values()].sort((left, right) => right.cost - left.cost);
}

/**
 * What one billable unit of a kind of work actually cost, against its price.
 *
 * `rate` is in half-points per unit, so halving it gives the quoted price for
 * the same thing the ledger measured. A positive gap means the quote is under
 * what the work costs, which is the direction worth acting on.
 */
interface KindCost {
  key: string;
  kind: JobKind;
  tier: Tier;
  runs: number;
  units: number;
  actual: number;
  quoted: number;
  gap: number;
}

function byKind(rows: readonly AdminKindUsage[]): KindCost[] {
  return rows
    .filter((row) => row.units > 0)
    .map((row) => {
      const actual = row.credits / row.units;
      const quoted = rate(row.kind, row.tier) / 2;
      return {
        key: `${row.kind}-${row.tier}`,
        kind: row.kind,
        tier: row.tier,
        runs: row.runs,
        units: row.units,
        actual,
        quoted,
        gap: quoted > 0 ? (actual - quoted) / quoted : 0,
      };
    })
    .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap));
}

const percent = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.round(Math.abs(value) * 100)}%`;

export function AdminUsage() {
  const uid = useCloudStore((store) => store.user?.uid);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"models" | "kinds" | "accounts" | "runs">(
    "models",
  );
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
  const models = usage.data?.models ?? [];
  const accounts = byAccount(usage.data?.users ?? []);
  const kinds = byKind(usage.data?.kinds ?? []);
  const total = models.reduce(
    (sum, model) =>
      sum +
      (estimateCost({
        model: model.model,
        input: model.input,
        cached: model.cached,
        cacheWrite: model.cacheWrite,
        output: model.output,
      }) ?? 0),
    0,
  );
  const totalCredits = models.reduce(
    (sum, model) => sum + (model.credits ?? 0),
    0,
  );
  return (
    <div className="space-y-7">
      <LiquidTabs
        ariaLabel={t("admin.usage")}
        onValueChange={(value) => setView(value as typeof view)}
        options={[
          { label: t("admin.models"), value: "models" },
          { label: t("admin.byKind"), value: "kinds" },
          { label: t("admin.byUser"), value: "accounts" },
          { label: t("admin.recentRuns"), value: "runs" },
        ]}
        value={view}
      />
      {view === "models" && (
        <ListSection
          footer={t("admin.spentWindow")}
          header={t("admin.lastThirtyDays")}
        >
          {usage.isPending && <ListRow label={t("common.loading")} />}
          {models.map((model) => (
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
                    cacheWrite: model.cacheWrite,
                    output: model.output,
                  })}
                  credits={model.credits}
                />
              }
            />
          ))}
          {models.length > 0 && (
            <ListRow
              label={t("admin.totalCost")}
              value={<UsageValue cost={total} credits={totalCredits} />}
            />
          )}
          {!usage.isPending && models.length === 0 && (
            <ListRow label={t("admin.noUsage")} />
          )}
        </ListSection>
      )}
      {view === "kinds" && (
        <ListSection
          footer={t("admin.byKindFooter")}
          header={t("admin.byKind")}
        >
          {usage.isPending && <ListRow label={t("common.loading")} />}
          {kinds.map((entry) => (
            <ListRow
              detail={t("admin.kindTotals", {
                delta: percent(entry.gap),
                quoted: entry.quoted.toFixed(1),
                runs: entry.runs,
                units: entry.units.toLocaleString(),
              })}
              key={entry.key}
              label={`${jobKindLabel(entry.kind)} · ${t(`managed.${entry.tier}`)}`}
              value={t("admin.kindCost", { cost: entry.actual.toFixed(2) })}
            />
          ))}
          {!usage.isPending && kinds.length === 0 && (
            <ListRow label={t("admin.noKindUsage")} />
          )}
        </ListSection>
      )}
      {view === "accounts" && (
        <ListSection
          footer={t("admin.byUserFooter")}
          header={t("admin.byUser")}
        >
          {usage.isPending && <ListRow label={t("common.loading")} />}
          {accounts.map((account) => (
            <ListRow
              detail={t("admin.userTotals", {
                points: account.points.toLocaleString(),
                runs: account.runs,
                tokens: account.tokens.toLocaleString(),
              })}
              key={account.uid}
              label={account.email ?? account.uid}
              value={
                <UsageValue cost={account.cost} credits={account.credits} />
              }
            />
          ))}
          {!usage.isPending && accounts.length === 0 && (
            <ListRow label={t("admin.noUserUsage")} />
          )}
        </ListSection>
      )}
      {view === "runs" && (
        <ListSection header={t("admin.recentRuns")}>
          {usage.isPending && <ListRow label={t("common.loading")} />}
          {usage.data?.entries.map((entry) => (
            <ListRow
              detail={t("admin.runTotals", {
                input: (entry.input ?? 0).toLocaleString(),
                cached: (entry.cached ?? 0).toLocaleString(),
                output: (entry.output ?? 0).toLocaleString(),
              })}
              key={entry.id}
              label={
                entry.status === "complete"
                  ? (entry.email ?? entry.uid)
                  : `${entry.email ?? entry.uid} · ${t("admin.runFailed")}`
              }
              value={
                <UsageValue
                  cost={estimateCost({
                    model: entry.model,
                    input: entry.input ?? 0,
                    cached: entry.cached ?? 0,
                    cacheWrite: entry.cacheWrite ?? 0,
                    output: entry.output ?? 0,
                  })}
                  credits={entry.credits}
                />
              }
            />
          ))}
          {!usage.isPending && usage.data?.entries.length === 0 && (
            <ListRow label={t("admin.noUsage")} />
          )}
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
