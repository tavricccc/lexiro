"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminAccount } from "@lexiro/ai-contract";
import { useState } from "react";

import { AdminIssue, AdminPager, type AdminSettingsValue } from "./admin-shared";
import { ListActionRow, ListInputRow, ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { managedJson, notifyManagedAccountChanged } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminAccountList() {
  const uid = useCloudStore((store) => store.user?.uid);
  const [offset, setOffset] = useState(0);
  const accounts = useQuery({
    queryKey: ["admin-accounts", uid, offset],
    queryFn: () =>
      managedJson<{ accounts: AdminAccount[]; nextOffset: number | null }>(
        `/admin/accounts?offset=${offset}`,
      ),
    retry: false,
  });
  return (
    <div className="space-y-7">
      {accounts.error && (
        <AdminIssue
          message={accounts.error.message}
          onRetry={() => void accounts.refetch()}
        />
      )}
      <ListSection>
        {accounts.isPending && <ListRow label={t("common.loading")} />}
        {accounts.data?.accounts.map((entry) => (
          <ListNavRow
            detail={
              entry.monthly > 0
                ? t("managed.monthly", { points: entry.monthly })
                : t("managed.oneTime")
            }
            href={`/me/admin/accounts/${encodeURIComponent(entry.uid)}`}
            key={entry.uid}
            label={entry.email}
            value={String(entry.points)}
          />
        ))}
        {accounts.data?.accounts.length === 0 && (
          <ListRow label={t("admin.noAccounts")} />
        )}
      </ListSection>
      <ListSection>
        <ListNavRow href="/me/admin/accounts/new" label={t("admin.create")} />
      </ListSection>
      <AdminPager
        hasNext={accounts.data?.nextOffset != null}
        hasPrevious={offset > 0}
        onNext={() => setOffset(accounts.data!.nextOffset!)}
        onPrevious={() => setOffset(Math.max(0, offset - 100))}
      />
    </div>
  );
}

export function AdminAccountEditor({ accountUid }: { accountUid?: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const account = useQuery({
    enabled: Boolean(accountUid),
    queryKey: ["admin-account", uid, accountUid],
    queryFn: () =>
      managedJson<AdminAccount>(
        `/admin/accounts/${encodeURIComponent(accountUid!)}`,
      ),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["admin-settings", uid],
    queryFn: () => managedJson<AdminSettingsValue>("/admin/settings"),
    retry: false,
  });
  const issue = account.error?.message || settings.error?.message;
  if (issue)
    return (
      <AdminIssue
        message={issue}
        onRetry={() => {
          void account.refetch();
          void settings.refetch();
        }}
      />
    );
  if (settings.isPending || (accountUid && account.isPending))
    return (
      <ListSection>
        <ListRow label={t("common.loading")} />
      </ListSection>
    );
  return (
    <AccountForm
      account={account.data}
      defaults={settings.data!}
    />
  );
}

function AccountForm({
  account,
  defaults,
}: {
  account?: AdminAccount;
  defaults: AdminSettingsValue;
}) {
  const client = useQueryClient();
  const cloudUid = useCloudStore((store) => store.user?.uid);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState(
    String(account ? 0 : defaults.defaultInitial),
  );
  const [monthly, setMonthly] = useState(
    String(account?.monthly ?? defaults.defaultMonthly),
  );
  const [note, setNote] = useState(account?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setSaved(false);
        setError("");
        const values = { monthly: Number(monthly), note };
        const path = account
          ? `/admin/accounts/${encodeURIComponent(account.uid)}`
          : "/admin/accounts";
        void managedJson(path, {
          method: account ? "PATCH" : "POST",
          body: JSON.stringify(
            account
              ? { ...values, addPoints: Number(points) }
              : {
                  ...values,
                  uid: uid.trim(),
                  email: email.trim(),
                  points: Number(points),
                },
          ),
        })
          .then(async () => {
            await client.invalidateQueries({ queryKey: ["admin-accounts", cloudUid] });
            await client.invalidateQueries({ queryKey: ["admin-account", cloudUid] });
            notifyManagedAccountChanged();
            setSaved(true);
            if (account) setPoints("0");
          })
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : t("managed.failed")),
          )
          .finally(() => setBusy(false));
      }}
    >
      {account && (
        <ListSection>
          <ListRow label={t("admin.email")} value={account.email} />
          <ListRow label={t("managed.pointsLabel")} value={String(account.points)} />
        </ListSection>
      )}
      <ListSection footer={t("admin.monthlyHint")}>
        {!account && (
          <>
            <ListInputRow label={t("managed.accountId")} maxLength={128} onChange={setUid} required value={uid} />
            <ListInputRow inputMode="email" label={t("admin.email")} onChange={setEmail} required type="email" value={email} />
          </>
        )}
        <ListInputRow inputMode="numeric" label={t(account ? "admin.adjust" : "admin.initialPoints")} max={1_000_000} min={account ? -1_000_000 : 0} onChange={setPoints} required type="number" value={points} />
        <ListInputRow inputMode="numeric" label={t("admin.monthly")} max={1_000_000} min={0} onChange={setMonthly} required type="number" value={monthly} />
        <ListInputRow label={t("admin.note")} maxLength={500} onChange={setNote} value={note} />
      </ListSection>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <ListSection footer={saved ? t("me.saved") : undefined}>
        <ListActionRow disabled={busy} type="submit">
          {t(account ? "admin.save" : "admin.create")}
        </ListActionRow>
      </ListSection>
    </form>
  );
}
