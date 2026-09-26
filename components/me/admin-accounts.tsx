"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminAccount, AdminAccountsPage } from "@lexiro/ai-contract";
import { useState } from "react";

import { toast } from "sonner";

import { AdminIssue, AdminPager } from "./admin-shared";
import { useAdminPagination } from "./use-admin-pagination";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { StepActions } from "@/components/ui/step-actions";
import {
  ListChoiceGroup,
  ListInputRow,
  ListNavRow,
  ListRow,
  ListSection,
} from "@/components/ui/list";
import { managedJson, notifyManagedAccountChanged } from "@/lib/managed-client";
import { t } from "@/lib/i18n";
import { canonicalHash } from "@/src/lib/hash";
import { useCloudStore } from "@/stores/cloud-store";

export function AdminAccountList() {
  const uid = useCloudStore((store) => store.user?.uid);
  const pages = useAdminPagination();
  const accounts = useQuery({
    queryKey: ["admin-accounts", uid, pages.cursor],
    queryFn: () =>
      managedJson<AdminAccountsPage>(
        `/admin/accounts${pages.cursor ? `?cursor=${encodeURIComponent(pages.cursor)}` : ""}`,
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
            href={`/app/me/admin/accounts/${encodeURIComponent(entry.uid)}`}
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
        hasNext={accounts.data?.nextCursor != null}
        hasPrevious={pages.hasPrevious}
        onNext={() => pages.next(accounts.data!.nextCursor!)}
        onPrevious={pages.previous}
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
  const revision = canonicalHash({
    points: account.data.points,
    monthly: account.data.monthly,
    renewsAt: account.data.renews_at,
    note: account.data.note,
  });
  return (
    <AccountForm
      account={account.data}
      key={`${account.data.uid}:${revision}`}
      revision={revision}
    />
  );
}

/**
 * Giving and taking points are the same errand in opposite directions, so the
 * direction is a choice and the amount is always a count of points.
 *
 * One signed field said otherwise: it asked for "-500" on a numeric keypad that
 * has no minus key, which made taking points away unreachable on a phone. The
 * row underneath says what the balance will become, because the question being
 * asked is "what will they have", not "what am I typing".
 */
function AccountForm({
  account,
  revision,
}: {
  account: AdminAccount;
  revision: string;
}) {
  const client = useQueryClient();
  const cloudUid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft(
    `lexiro:flow-draft:v1:${cloudUid ?? "local"}:admin-account:${account.uid}:${revision}`,
    {
      direction: "add" as "add" | "subtract",
      amount: "0",
      monthly: String(account.monthly),
      note: account.note ?? "",
    },
  );
  const { direction, amount, monthly, note } = saved.draft;
  const [busy, setBusy] = useState(false);

  const magnitude = Math.max(0, Math.floor(Number(amount) || 0));
  const addPoints = direction === "add" ? magnitude : -magnitude;
  const allowance = Math.max(0, Math.floor(Number(monthly) || 0));
  // A balance floors at zero and a newly set allowance is handed over at once,
  // so the preview has to say both or it promises something else.
  const adjusted = Math.max(0, account.points + addPoints);
  const resulting =
    allowance > 0 && allowance !== account.monthly
      ? Math.max(adjusted, allowance)
      : adjusted;

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
            : "draft.adminAccountDescription",
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
      id="admin-account-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void managedJson(`/admin/accounts/${encodeURIComponent(account.uid)}`, {
          method: "PATCH",
          body: JSON.stringify({ addPoints, monthly: allowance, note }),
        })
          .then(async () => {
            await client.invalidateQueries({
              queryKey: ["admin-accounts", cloudUid],
            });
            await client.invalidateQueries({
              queryKey: ["admin-account", cloudUid],
            });
            notifyManagedAccountChanged();
            toast.success(t("admin.accountSaved", { points: resulting }));
            saved.restart();
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
      <ListSection>
        <ListRow icon={Icons.account} label={account.email} />
        <ListRow
          icon={Icons.credit}
          label={t("managed.pointsLabel")}
          value={String(account.points)}
        />
        <ListRow
          icon={Icons.refresh}
          label={t("managed.allowanceLabel")}
          value={
            account.monthly > 0
              ? t("managed.monthly", { points: account.monthly })
              : t("managed.oneTime")
          }
        />
      </ListSection>

      <ListSection header={t("admin.adjust")}>
        <ListChoiceGroup
          disabled={busy}
          label={t("admin.adjust")}
          onSelect={(direction) => saved.update({ direction })}
          value={direction}
          options={[
            { id: "add", label: t("admin.addPoints") },
            { id: "subtract", label: t("admin.subtractPoints") },
          ]}
        />
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.amount")}
          max={1_000_000}
          min={0}
          onChange={(amount) => saved.update({ amount })}
          required
          type="number"
          value={amount}
        />
        <ListRow
          label={t("admin.resultingBalance")}
          tone={resulting === account.points ? "default" : "brand"}
          value={String(resulting)}
        />
      </ListSection>

      <ListSection footer={t("admin.monthlyHint")}>
        <ListInputRow
          disabled={busy}
          inputMode="numeric"
          label={t("admin.monthly")}
          max={1_000_000}
          min={0}
          onChange={(monthly) => saved.update({ monthly })}
          required
          type="number"
          value={monthly}
        />
        <ListInputRow
          disabled={busy}
          label={t("admin.note")}
          maxLength={500}
          onChange={(note) => saved.update({ note })}
          value={note}
        />
      </ListSection>

      <StepActions>
        <Button
          className="w-full"
          disabled={busy}
          form="admin-account-form"
          size="lg"
          type="submit"
        >
          <Icons.success />
          {t(busy ? "admin.saving" : "admin.save")}
        </Button>
      </StepActions>
    </form>
  );
}
