"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminAccount } from "@lexiro/ai-contract";
import { useState } from "react";

import { AdminIssue, AdminPager } from "./admin-shared";
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
      <AdminPager
        hasNext={accounts.data?.nextOffset != null}
        hasPrevious={offset > 0}
        onNext={() => setOffset(accounts.data!.nextOffset!)}
        onPrevious={() => setOffset(Math.max(0, offset - 100))}
      />
    </div>
  );
}

/** An account exists because someone signed in, so this only ever edits one. */
export function AdminAccountEditor({ accountUid }: { accountUid: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const account = useQuery({
    queryKey: ["admin-account", uid, accountUid],
    queryFn: () =>
      managedJson<AdminAccount>(
        `/admin/accounts/${encodeURIComponent(accountUid)}`,
      ),
    retry: false,
  });
  if (account.error)
    return (
      <AdminIssue
        message={account.error.message}
        onRetry={() => void account.refetch()}
      />
    );
  if (account.isPending)
    return (
      <ListSection>
        <ListRow label={t("common.loading")} />
      </ListSection>
    );
  return <AccountForm account={account.data} />;
}

function AccountForm({ account }: { account: AdminAccount }) {
  const client = useQueryClient();
  const cloudUid = useCloudStore((store) => store.user?.uid);
  const [points, setPoints] = useState("0");
  const [monthly, setMonthly] = useState(String(account.monthly));
  const [note, setNote] = useState(account.note ?? "");
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
        void managedJson(`/admin/accounts/${encodeURIComponent(account.uid)}`, {
          method: "PATCH",
          body: JSON.stringify({
            addPoints: Number(points),
            monthly: Number(monthly),
            note,
          }),
        })
          .then(async () => {
            await client.invalidateQueries({ queryKey: ["admin-accounts", cloudUid] });
            await client.invalidateQueries({ queryKey: ["admin-account", cloudUid] });
            notifyManagedAccountChanged();
            setSaved(true);
            setPoints("0");
          })
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : t("managed.failed")),
          )
          .finally(() => setBusy(false));
      }}
    >
      <ListSection>
        <ListRow label={t("admin.email")} value={account.email} />
        <ListRow label={t("managed.pointsLabel")} value={String(account.points)} />
      </ListSection>
      <ListSection footer={t("admin.monthlyHint")}>
        <ListInputRow inputMode="numeric" label={t("admin.adjust")} max={1_000_000} min={-1_000_000} onChange={setPoints} required type="number" value={points} />
        <ListInputRow inputMode="numeric" label={t("admin.monthly")} max={1_000_000} min={0} onChange={setMonthly} required type="number" value={monthly} />
        <ListInputRow label={t("admin.note")} maxLength={500} onChange={setNote} value={note} />
      </ListSection>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <ListSection footer={saved ? t("me.saved") : undefined}>
        <ListActionRow disabled={busy} type="submit">
          {t("admin.save")}
        </ListActionRow>
      </ListSection>
    </form>
  );
}
