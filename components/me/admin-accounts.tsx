"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminAccount,
  AdminAccountAdjustment,
  AdminAccountsPage,
} from "@lexiro/ai-contract";
import { useRef, useState } from "react";

import { toast } from "sonner";

import { AdminIssue, AdminPager } from "./admin-shared";
import { useAdminPagination } from "./use-admin-pagination";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  accountAdjustment,
  adjustmentBalance,
  hasAccountAdjustment,
} from "@/src/lib/admin-account-adjustment";
import { AiRequestError } from "@/src/lib/ai/errors";
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
    refetchOnWindowFocus: false,
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
  const saving = useRef(false);
  const [review, setReview] = useState<AdminAccountAdjustment | null>(null);
  const [problem, setProblem] = useState("");
  const [stale, setStale] = useState(false);
  const adjustment = accountAdjustment(account, {
    direction,
    amount,
    monthly,
    note,
  });
  const resulting = adjustmentBalance(account, adjustment);
  const changed = hasAccountAdjustment(adjustment);

  const apply = async (value: AdminAccountAdjustment) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setProblem("");
    setStale(false);
    try {
      const stored = await managedJson<AdminAccount>(
        `/admin/accounts/${encodeURIComponent(account.uid)}`,
        {
          method: "PATCH",
          body: JSON.stringify(value),
        },
      );
      saved.update({
        direction: "add",
        amount: "0",
        monthly: String(stored.monthly),
        note: stored.note ?? "",
      });
      saved.clear();
      client.setQueryData(["admin-account", cloudUid, account.uid], stored);
      void client.invalidateQueries({ queryKey: ["admin-accounts", cloudUid] });
      notifyManagedAccountChanged();
      toast.success(
        stored.points < 0
          ? t("admin.noteSavedPending")
          : t("admin.accountSaved", { points: stored.points }),
      );
    } catch (reason) {
      setStale(
        reason instanceof AiRequestError && reason.code === "stale_account",
      );
      setProblem(
        reason instanceof Error ? reason.message : t("managed.failed"),
      );
      throw reason;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    await client.fetchQuery({
      queryKey: ["admin-account", cloudUid, account.uid],
      queryFn: () =>
        managedJson<AdminAccount>(
          `/admin/accounts/${encodeURIComponent(account.uid)}`,
        ),
      staleTime: 0,
    });
    setReview(null);
    setStale(false);
    setProblem("");
  };
  const reviewDescription = review
    ? [
        t("admin.accountTarget", { email: account.email }),
        review.addPoints !== undefined
          ? t(
              review.addPoints > 0
                ? "admin.confirmAddPoints"
                : "admin.confirmSubtractPoints",
              { points: Math.abs(review.addPoints) },
            )
          : "",
        review.monthly !== undefined
          ? review.monthly > 0
            ? t("admin.confirmMonthly", { points: review.monthly })
            : t("admin.confirmMonthlyOff")
          : "",
        review.note !== undefined
          ? t("admin.confirmNote", {
              note: review.note || t("admin.emptyNote"),
            })
          : "",
        t("admin.balancePreview", {
          points: adjustmentBalance(account, review),
        }),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

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
        if (saving.current || !changed) return;
        if (
          adjustment.addPoints !== undefined ||
          adjustment.monthly !== undefined
        )
          setReview(adjustment);
        else void apply(adjustment).catch(() => undefined);
      }}
    >
      <DraftSaveStatus status={saved.persistence} />
      {problem && (
        <div className="space-y-3">
          <p className="text-sm text-destructive" role="alert">
            {problem}
          </p>
          {stale && (
            <Button
              disabled={busy}
              type="button"
              onClick={() =>
                void reload().catch((reason: unknown) =>
                  setProblem(
                    reason instanceof Error
                      ? reason.message
                      : t("managed.failed"),
                  ),
                )
              }
              variant="outline"
            >
              <Icons.refresh />
              {t("admin.reloadAccount")}
            </Button>
          )}
        </div>
      )}
      <ListSection>
        <ListRow icon={Icons.account} label={account.email} />
        <ListRow
          icon={Icons.credit}
          label={t("managed.pointsLabel")}
          value={String(account.points)}
          detail={account.points < 0 ? t("admin.reservationHint") : undefined}
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
          form="admin-account-form"
          disabled={busy || !changed}
          size="lg"
          type="submit"
        >
          <Icons.success />
          {t(busy ? "admin.saving" : "admin.save")}
        </Button>
      </StepActions>
      <ConfirmDialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        title={t("admin.confirmAccount")}
        description={reviewDescription}
        confirmLabel={t("admin.confirmSave")}
        onConfirm={() => (review ? apply(review) : undefined)}
        onRetry={stale ? reload : undefined}
        retryLabel={stale ? t("admin.reloadAccount") : undefined}
        tone="default"
      />
    </form>
  );
}
