"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  estimateCost,
  type AdminAccount,
  type AdminUsageEntry,
} from "@lexiro/ai-contract";
import { formatCost } from "@/components/ai/ai-usage";
import { MeSection } from "@/components/me/me-section";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
 * behind its own row, so the panel opens as a short list of three things and the
 * screen only ever asks for the one you chose.
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
    queryFn: () => managedJson<UsageReport>(`/admin/usage?offset=${usageOffset}`),
    retry: false,
    enabled: view.name === "usage" || view.name === "menu",
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
  return (
    <MeSection
      icon={Icons.settings}
      title={t("managed.admin")}
      description={t("admin.description")}
    >
      <div className="space-y-5">
        {issue && (
          <div role="alert">
            <p className="text-sm text-destructive">{issue}</p>
            <Button
              variant="ghost"
              onClick={() => {
                void accounts.refetch();
                void settings.refetch();
                void usage.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}

        {view.name === "menu" && (
          <ChoiceList
            onSelect={(value) => setView({ name: value } as View)}
            options={[
              {
                description: t("admin.accountsSummary"),
                icon: Icons.account,
                label: t("admin.accounts"),
                meta: accounts.data
                  ? t("admin.accountsCount", {
                      count: accounts.data.accounts.length,
                    })
                  : t("common.loading"),
                metaEmpty: accounts.data?.accounts.length === 0,
                value: "accounts",
              },
              {
                description: t("admin.usageSummary"),
                icon: Icons.stats,
                label: t("admin.usage"),
                meta: usage.data
                  ? t("admin.spentRecently", { cost: formatCost(spend) })
                  : t("common.loading"),
                metaEmpty: usage.data?.models.length === 0,
                value: "usage",
              },
              {
                description: t("admin.settingsSummary"),
                icon: Icons.settings,
                label: t("admin.settings"),
                meta: settings.data
                  ? t(
                      settings.data.freeTrial
                        ? "admin.trialOn"
                        : "admin.trialOff",
                    )
                  : t("common.loading"),
                metaEmpty: settings.data?.freeTrial === false,
                value: "settings",
              },
            ]}
          />
        )}

        {view.name === "accounts" && (
          <Step
            onBack={() => setView({ name: "menu" })}
            title={t("admin.accounts")}
          >
            {accounts.isPending && <p role="status">{t("common.loading")}</p>}
            <div className="rule-card rule-list">
              {accounts.data?.accounts.map((entry) => (
                <button
                  className="t-row flex w-full items-center justify-between gap-4 py-4 text-left"
                  key={entry.uid}
                  onClick={() => setView({ name: "account", uid: entry.uid })}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {entry.email}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.monthly > 0
                        ? t("managed.monthly", { points: entry.monthly })
                        : t("managed.oneTime")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-muted-foreground">
                    {t("managed.balance", { points: entry.points })}
                    <Icons.open aria-hidden className="size-4" />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => setView({ name: "create" })}>
                <Icons.create />
                {t("admin.create")}
              </Button>
              <Button
                className="ml-auto"
                disabled={offset === 0 || busy}
                onClick={() => setOffset(Math.max(0, offset - 100))}
                size="sm"
                variant="ghost"
              >
                {t("admin.previous")}
              </Button>
              <Button
                disabled={accounts.data?.nextOffset == null || busy}
                onClick={() => setOffset(accounts.data!.nextOffset!)}
                size="sm"
                variant="ghost"
              >
                {t("admin.next")}
              </Button>
            </div>
          </Step>
        )}

        {view.name === "create" && (
          <Step
            onBack={() => setView({ name: "accounts" })}
            title={t("admin.create")}
          >
            <AccountForm
              busy={busy}
              onSubmit={(body) =>
                mutate("/admin/accounts", "POST", body).then(() =>
                  setView({ name: "accounts" }),
                )
              }
            />
          </Step>
        )}

        {view.name === "account" && (
          <Step
            onBack={() => setView({ name: "accounts" })}
            title={account?.email ?? t("admin.accounts")}
          >
            {account ? (
              <>
                <dl className="rule-card rule-list mb-5">
                  <Detail
                    label={t("managed.accountId")}
                    value={account.uid}
                    wrap
                  />
                  <Detail
                    label={t("managed.balance", { points: account.points })}
                    value={
                      account.monthly > 0
                        ? t("managed.renewsAt", {
                            date: new Date(
                              account.renews_at * 1000,
                            ).toLocaleDateString("zh-TW"),
                          })
                        : t("managed.oneTime")
                    }
                  />
                  {account.note && (
                    <Detail label={t("admin.note")} value={account.note} wrap />
                  )}
                </dl>
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
              <p role="status">{t("common.loading")}</p>
            )}
          </Step>
        )}

        {view.name === "usage" && (
          <Step
            onBack={() => setView({ name: "menu" })}
            title={t("admin.usage")}
          >
            {usage.isPending && <p role="status">{t("common.loading")}</p>}
            {usage.data && (
              <>
                <p className="text-2xl font-medium tabular-nums">
                  {formatCost(spend)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("admin.spentWindow")}
                </p>
                <dl className="rule-card rule-list mt-5">
                  {usage.data.models.map((model) => (
                    <Detail
                      key={model.model}
                      label={model.model}
                      value={t("admin.modelTotals", {
                        runs: model.runs,
                        tokens: (
                          model.input + model.output
                        ).toLocaleString(),
                        cost: formatCost(estimateCost(model)),
                      })}
                    />
                  ))}
                  {!usage.data.models.length && (
                    <p className="py-4 text-sm text-muted-foreground">
                      {t("admin.noUsage")}
                    </p>
                  )}
                </dl>
                <h3 className="mt-7 text-sm font-medium">
                  {t("admin.recentRuns")}
                </h3>
                <dl className="rule-card rule-list mt-3">
                  {usage.data.entries.map((entry) => (
                    <Detail
                      key={entry.id}
                      label={`${entry.email ?? entry.uid} · ${new Date(entry.created_at * 1000).toLocaleString("zh-TW")}`}
                      value={t("admin.runTotals", {
                        input: (entry.input ?? 0).toLocaleString(),
                        cached: (entry.cached ?? 0).toLocaleString(),
                        output: (entry.output ?? 0).toLocaleString(),
                        cost: formatCost(
                          estimateCost({
                            model: entry.model,
                            input: entry.input ?? 0,
                            cached: entry.cached ?? 0,
                            output: entry.output ?? 0,
                          }),
                        ),
                      })}
                    />
                  ))}
                </dl>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    disabled={usageOffset === 0}
                    onClick={() => setUsageOffset(Math.max(0, usageOffset - 50))}
                    size="sm"
                    variant="ghost"
                  >
                    {t("admin.previous")}
                  </Button>
                  <Button
                    disabled={usage.data.nextOffset == null}
                    onClick={() => setUsageOffset(usage.data!.nextOffset!)}
                    size="sm"
                    variant="ghost"
                  >
                    {t("admin.next")}
                  </Button>
                </div>
              </>
            )}
          </Step>
        )}

        {view.name === "settings" && (
          <Step
            onBack={() => setView({ name: "menu" })}
            title={t("admin.settings")}
          >
            {settings.data && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("admin.trial")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.trialHint")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void mutate("/admin/settings", "PATCH", {
                      freeTrial: !settings.data.freeTrial,
                    }).catch(() => {});
                  }}
                >
                  {t(
                    settings.data.freeTrial
                      ? "admin.disableTrial"
                      : "admin.enableTrial",
                  )}
                </Button>
              </div>
            )}
          </Step>
        )}
      </div>
    </MeSection>
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

/** The one way back, above the one thing this screen is asking for. */
function Step({
  children,
  onBack,
  title,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackControl onClick={onBack} />
        <h3 className="truncate text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Detail({
  label,
  value,
  wrap,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-sm">{label}</dt>
      <dd
        className={`text-xs tabular-nums text-muted-foreground ${wrap ? "break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
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
      className="space-y-3"
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
      {!account && (
        <>
          <Field label={t("managed.accountId")}>
            <Input
              required
              maxLength={128}
              value={uid}
              onChange={(event) => setUid(event.target.value)}
            />
          </Field>
          <Field label={t("admin.email")}>
            <Input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t(account ? "admin.adjust" : "admin.initialPoints")}>
          <Input
            type="number"
            required
            min={account ? -1000000 : 0}
            max={1000000}
            step={1}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        </Field>
        <Field label={t("admin.monthly")}>
          <Input
            type="number"
            required
            min={0}
            max={1000000}
            step={1}
            value={monthly}
            onChange={(event) => setMonthly(event.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{t("admin.monthlyHint")}</p>
      <Field label={t("admin.note")}>
        <Input
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {t(account ? "admin.save" : "admin.create")}
      </Button>
      {saved && (
        <span role="status" className="ml-3 text-sm text-muted-foreground">
          {t("me.saved")}
        </span>
      )}
    </form>
  );
}
