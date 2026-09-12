"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  estimateCost,
  type AdminAccount,
  type AdminUsageEntry,
} from "@lexiro/ai-contract";
import { formatCost } from "@/components/ai/ai-usage";
import { BackControl } from "@/components/ui/back-control";
import {
  ListActionRow,
  ListInputRow,
  ListNavRow,
  ListRow,
  ListSection,
} from "@/components/ui/list";
import { Icons } from "@/components/ui/icons";
import { managedJson, notifyManagedAccountChanged } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

interface UsageReport {
  entries: AdminUsageEntry[];
  nextOffset: number | null;
  models: {
    model: string;
    runs: number;
    input: number;
    cached: number;
    output: number;
  }[];
}

/** One screen at a time, the way the rest of the app asks for things. */
type View =
  | { name: "menu" }
  | { name: "accounts" }
  | { name: "account"; uid: string }
  | { name: "create" }
  | { name: "usage" }
  | { name: "settings" };

/**
 * Administration as a place you walk into, not a wall you read.
 *
 * Everything here used to be open at once: the trial switch, a creation form, a
 * form per account and the pager, all competing on one screen. Each task is now
 * a row that leads to the one screen that task needs, with a single way back.
 */
export function AdminPanel() {
  const uid = useCloudStore((store) => store.user?.uid);
  const client = useQueryClient();
  const [view, setView] = useState<View>({ name: "menu" });
  const [offset, setOffset] = useState(0);
  const [usageOffset, setUsageOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accounts = useQuery({
    queryKey: ["admin-accounts", uid, offset],
    queryFn: () =>
      managedJson<{ accounts: AdminAccount[]; nextOffset: number | null }>(
        `/admin/accounts?offset=${offset}`,
      ),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["admin-settings", uid],
    queryFn: () => managedJson<{ freeTrial: boolean }>("/admin/settings"),
    retry: false,
  });
  const usage = useQuery({
    queryKey: ["admin-usage", uid, usageOffset],
    queryFn: () =>
      managedJson<UsageReport>(`/admin/usage?offset=${usageOffset}`),
    retry: false,
  });
  const mutate = async (
    path: string,
    method: "POST" | "PATCH",
    body: object,
  ) => {
    setBusy(true);
    setError("");
    try {
      await managedJson(path, { method, body: JSON.stringify(body) });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-accounts", uid] }),
        client.invalidateQueries({ queryKey: ["admin-settings", uid] }),
      ]);
      notifyManagedAccountChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("managed.failed"));
      throw reason;
    } finally {
      setBusy(false);
    }
  };
  const issue =
    error ||
    accounts.error?.message ||
    settings.error?.message ||
    usage.error?.message;
  const account =
    view.name === "account"
      ? accounts.data?.accounts.find((entry) => entry.uid === view.uid)
      : undefined;
  const spend = totalCost(usage.data?.models ?? []);

  if (view.name === "menu")
    return (
      <div className="space-y-7">
        {issue && <Issue message={issue} onRetry={() => {
          void accounts.refetch();
          void settings.refetch();
          void usage.refetch();
        }} />}
        <ListSection
          footer={t("admin.description")}
          header={t("managed.admin")}
        >
          <ListNavRow
            icon={Icons.account}
            label={t("admin.accounts")}
            onClick={() => setView({ name: "accounts" })}
            value={
              accounts.data
                ? t("admin.accountsCount", {
                    count: accounts.data.accounts.length,
                  })
                : t("common.loading")
            }
          />
          <ListNavRow
            icon={Icons.stats}
            label={t("admin.usage")}
            onClick={() => setView({ name: "usage" })}
            value={
              usage.data ? formatCost(spend) : t("common.loading")
            }
          />
          <ListNavRow
            icon={Icons.settings}
            label={t("admin.settings")}
            onClick={() => setView({ name: "settings" })}
            value={
              settings.data
                ? t(settings.data.freeTrial ? "admin.trialOn" : "admin.trialOff")
                : t("common.loading")
            }
          />
        </ListSection>
      </div>
    );

  return (
    <div className="space-y-7">
      <div className="-ml-2 flex items-center gap-1">
        <BackControl
          label={t("managed.admin")}
          onClick={() =>
            setView(
              view.name === "account" || view.name === "create"
                ? { name: "accounts" }
                : { name: "menu" },
            )
          }
        />
      </div>
      {issue && <Issue message={issue} onRetry={() => {
        void accounts.refetch();
        void settings.refetch();
        void usage.refetch();
      }} />}

      {view.name === "accounts" && (
        <>
          <ListSection header={t("admin.accounts")}>
            {accounts.isPending && <ListRow label={t("common.loading")} />}
            {accounts.data?.accounts.map((entry) => (
              <ListNavRow
                detail={
                  entry.monthly > 0
                    ? t("managed.monthly", { points: entry.monthly })
                    : t("managed.oneTime")
                }
                key={entry.uid}
                label={entry.email}
                onClick={() => setView({ name: "account", uid: entry.uid })}
                value={String(entry.points)}
              />
            ))}
            {accounts.data?.accounts.length === 0 && (
              <ListRow label={t("admin.noAccounts")} />
            )}
          </ListSection>
          <ListSection>
            <ListActionRow onClick={() => setView({ name: "create" })}>
              {t("admin.create")}
            </ListActionRow>
          </ListSection>
          <Pager
            onNext={() => setOffset(accounts.data!.nextOffset!)}
            onPrevious={() => setOffset(Math.max(0, offset - 100))}
            hasNext={accounts.data?.nextOffset != null}
            hasPrevious={offset > 0}
          />
        </>
      )}

      {view.name === "create" && (
        <AccountForm
          busy={busy}
          onSubmit={(body) =>
            mutate("/admin/accounts", "POST", body).then(() =>
              setView({ name: "accounts" }),
            )
          }
        />
      )}

      {view.name === "account" &&
        (account ? (
          <>
            <ListSection header={account.email}>
              <ListRow label={t("managed.accountId")} value={account.uid} />
              <ListRow
                label={t("managed.pointsLabel")}
                value={String(account.points)}
              />
              <ListRow
                label={t("managed.renewsLabel")}
                value={
                  account.monthly > 0
                    ? new Date(account.renews_at * 1000).toLocaleDateString(
                        "zh-TW",
                      )
                    : t("managed.oneTime")
                }
              />
              {account.note && (
                <ListRow label={t("admin.note")} value={account.note} />
              )}
            </ListSection>
            <AccountForm
              account={account}
              busy={busy}
              onSubmit={(body) =>
                mutate(
                  `/admin/accounts/${encodeURIComponent(account.uid)}`,
                  "PATCH",
                  body,
                )
              }
            />
          </>
        ) : (
          <ListSection>
            <ListRow label={t("common.loading")} />
          </ListSection>
        ))}

      {view.name === "usage" && (
        <>
          <ListSection
            footer={t("admin.spentWindow")}
            header={t("admin.usage")}
          >
            {usage.isPending && <ListRow label={t("common.loading")} />}
            {usage.data?.models.map((model) => (
              <ListRow
                detail={t("admin.modelTotals", {
                  runs: model.runs,
                  tokens: (model.input + model.output).toLocaleString(),
                })}
                key={model.model}
                label={model.model}
                value={formatCost(estimateCost(model))}
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
                  value={formatCost(
                    estimateCost({
                      model: entry.model,
                      input: entry.input ?? 0,
                      cached: entry.cached ?? 0,
                      output: entry.output ?? 0,
                    }),
                  )}
                />
              ))}
            </ListSection>
          )}
          <Pager
            hasNext={usage.data?.nextOffset != null}
            hasPrevious={usageOffset > 0}
            onNext={() => setUsageOffset(usage.data!.nextOffset!)}
            onPrevious={() => setUsageOffset(Math.max(0, usageOffset - 50))}
          />
        </>
      )}

      {view.name === "settings" && settings.data && (
        <ListSection footer={t("admin.trialHint")} header={t("admin.settings")}>
          <ListActionRow
            disabled={busy}
            onClick={() => {
              void mutate("/admin/settings", "PATCH", {
                freeTrial: !settings.data.freeTrial,
              }).catch(() => {});
            }}
          >
            {t(
              settings.data.freeTrial ? "admin.disableTrial" : "admin.enableTrial",
            )}
          </ListActionRow>
        </ListSection>
      )}
    </div>
  );
}

function Issue({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ListSection>
      <ListRow label={message} tone="destructive" />
      <ListActionRow onClick={onRetry}>{t("common.retry")}</ListActionRow>
    </ListSection>
  );
}

function Pager({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (!hasNext && !hasPrevious) return null;
  return (
    <ListSection>
      {hasPrevious && (
        <ListActionRow onClick={onPrevious}>{t("admin.previous")}</ListActionRow>
      )}
      {hasNext && (
        <ListActionRow onClick={onNext}>{t("admin.next")}</ListActionRow>
      )}
    </ListSection>
  );
}

function totalCost(
  models: { model: string; input: number; cached: number; output: number }[],
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

function AccountForm({
  account,
  busy,
  onSubmit,
}: {
  account?: AdminAccount;
  busy: boolean;
  onSubmit: (body: object) => Promise<void>;
}) {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState(account ? "0" : "1000");
  const [monthly, setMonthly] = useState(String(account?.monthly ?? 1000));
  const [note, setNote] = useState(account?.note ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const values = { monthly: Number(monthly), note };
        void onSubmit(
          account
            ? { ...values, addPoints: Number(points) }
            : {
                ...values,
                uid: uid.trim(),
                email: email.trim(),
                points: Number(points),
              },
        )
          .then(() => {
            setSaved(true);
            if (account) setPoints("0");
          })
          .catch(() => {});
      }}
    >
      <ListSection
        footer={t("admin.monthlyHint")}
        header={t(account ? "admin.save" : "admin.create")}
      >
        {!account && (
          <>
            <ListInputRow
              label={t("managed.accountId")}
              maxLength={128}
              onChange={setUid}
              required
              value={uid}
            />
            <ListInputRow
              inputMode="email"
              label={t("admin.email")}
              onChange={setEmail}
              required
              type="email"
              value={email}
            />
          </>
        )}
        <ListInputRow
          inputMode="numeric"
          label={t(account ? "admin.adjust" : "admin.initialPoints")}
          max={1000000}
          min={account ? -1000000 : 0}
          onChange={setPoints}
          required
          type="number"
          value={points}
        />
        <ListInputRow
          inputMode="numeric"
          label={t("admin.monthly")}
          max={1000000}
          min={0}
          onChange={setMonthly}
          required
          type="number"
          value={monthly}
        />
        <ListInputRow
          label={t("admin.note")}
          maxLength={500}
          onChange={setNote}
          value={note}
        />
      </ListSection>
      <ListSection footer={saved ? t("me.saved") : undefined}>
        <ListActionRow disabled={busy} type="submit">
          {t(account ? "admin.save" : "admin.create")}
        </ListActionRow>
      </ListSection>
    </form>
  );
}
