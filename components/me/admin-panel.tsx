"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminAccount } from "@lexiro/ai-contract";
import { MeSection } from "@/components/me/me-section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { managedJson, notifyManagedAccountChanged } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminPanel() {
  const uid = useCloudStore((store) => store.user?.uid);
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
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
  const issue = error || accounts.error?.message || settings.error?.message;
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
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}
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
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("admin.create")}
          </summary>
          <AccountForm
            busy={busy}
            onSubmit={(body) => mutate("/admin/accounts", "POST", body)}
          />
        </details>
        {accounts.isPending && <p role="status">{t("common.loading")}</p>}
        <div className="space-y-2">
          {accounts.data?.accounts.map((account) => (
            <details key={account.uid} className="rounded-xl border p-4">
              <summary className="cursor-pointer break-all text-sm">
                <span className="font-medium">{account.email}</span>
                <span className="ml-3 tabular-nums text-muted-foreground">
                  {t("managed.balance", { points: account.points })}
                </span>
              </summary>
              <p className="mt-3 break-all text-xs text-muted-foreground">
                {account.uid}
              </p>
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
            </details>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={offset === 0 || busy}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            {t("admin.previous")}
          </Button>
          <Button
            variant="ghost"
            disabled={accounts.data?.nextOffset == null || busy}
            onClick={() => setOffset(accounts.data!.nextOffset!)}
          >
            {t("admin.next")}
          </Button>
        </div>
      </div>
    </MeSection>
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
      className="mt-4 space-y-3"
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
