import { useEffect, useState } from "react";

import { actionRow, AdminGate } from "@/components/admin/admin-page";
import { BackControl } from "@/components/ui/back-control";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import {
  adminApi,
  formatBytes,
  formatCount,
  formatTime,
  type AdminAccountAction,
  type AdminAccountDetail,
} from "@/lib/admin-client";
import { t, type TranslationKey } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";

const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : t("agent.requestFailed");

/** What each change asks before it runs. */
const CONFIRM: Record<
  AdminAccountAction["action"],
  { title: TranslationKey; description: TranslationKey; label: TranslationKey }
> = {
  disable: {
    title: "admin.disableTitle",
    description: "admin.disableDescription",
    label: "admin.disable",
  },
  enable: {
    title: "admin.enableTitle",
    description: "admin.enableDescription",
    label: "admin.enable",
  },
  exempt: {
    title: "admin.exemptTitle",
    description: "admin.exemptDescription",
    label: "admin.exempt",
  },
  unexempt: {
    title: "admin.unexemptTitle",
    description: "admin.unexemptDescription",
    label: "admin.unexempt",
  },
  revoke_access: {
    title: "admin.revokeTitle",
    description: "admin.revokeDescription",
    label: "admin.revokeAccess",
  },
};

export function AdminAccountPage({ uid }: { uid: string }) {
  return (
    <AdminGate back="/app/admin" title={t("admin.account")}>
      <AccountDetail uid={uid} />
    </AdminGate>
  );
}

function AccountDetail({ uid }: { uid: string }) {
  const self = useAdminStore((store) => store.uid);
  const [account, setAccount] = useState<AdminAccountDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<AdminAccountAction["action"] | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void adminApi.account(uid, controller.signal).then(
      (found) => {
        if (!controller.signal.aborted) setAccount(found);
      },
      (reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      },
    );
    return () => controller.abort();
  }, [uid, attempt]);

  const header = (
    <PageHeader
      back={<BackControl href="/app/admin" />}
      title={account?.email ?? t("admin.account")}
    />
  );
  if (error)
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  if (!account)
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <LoadingState />
      </div>
    );

  const run = async (action: AdminAccountAction["action"]) => {
    const input: AdminAccountAction =
      action === "disable" ? { action, reason: reason.trim() } : { action };
    setAccount(await adminApi.act(uid, input));
    setReason("");
  };
  const confirm = pending ? CONFIRM[pending] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      {header}
      <ListSection>
        <ListRow label={t("admin.uid")} value={account.uid} />
        <ListRow
          label={t("admin.email")}
          value={account.email ?? t("admin.noEmail")}
        />
        <ListRow label={t("admin.lastSeen")} value={account.seenDay ?? "—"} />
        <ListRow
          label={t("admin.status")}
          tone={account.disabled ? "destructive" : "default"}
          value={
            account.disabled
              ? t("admin.statusDisabled", { reason: account.disabled.reason })
              : t("admin.statusActive")
          }
          detail={
            account.disabled ? formatTime(account.disabled.at) : undefined
          }
        />
      </ListSection>
      <ListSection>
        <ListRow
          label={t("admin.writesToday")}
          value={formatCount(account.writesToday)}
        />
        <ListRow
          label={t("admin.readsToday")}
          value={formatCount(account.readsToday)}
        />
        <ListRow
          label={t("admin.storage")}
          value={formatBytes(account.storedBytes)}
        />
        <ListRow
          label={t("admin.library")}
          value={t("admin.librarySummary", {
            sets: formatCount(account.sets),
            words: formatCount(account.words),
            questions: formatCount(account.questions),
          })}
        />
        <ListRow
          label={t("admin.shares")}
          value={formatCount(account.shares)}
        />
        <ListRow
          label={t("admin.activeLinks")}
          value={formatCount(account.activeLinks)}
        />
      </ListSection>
      <ListSection header={t("admin.connections")}>
        {account.connections.length ? (
          account.connections.map((connection) => (
            <ListRow
              key={connection.id}
              label={connection.clientName}
              value={formatTime(connection.createdAt * 1000)}
            />
          ))
        ) : (
          <ListRow label={t("admin.noConnections")} />
        )}
      </ListSection>
      <ListSection>
        {account.disabled ? (
          <ListNavRow
            label={t("admin.enable")}
            tone="brand"
            onClick={() => setPending("enable")}
          />
        ) : (
          account.uid !== self && (
            <div className="space-y-3 py-3">
              <Field label={t("admin.reason")}>
                <Input
                  value={reason}
                  maxLength={200}
                  placeholder={t("admin.reasonPlaceholder")}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </div>
          )
        )}
        {!account.disabled && account.uid !== self && (
          <ListNavRow
            label={t("admin.disable")}
            tone="destructive"
            disabled={!reason.trim()}
            onClick={() => setPending("disable")}
          />
        )}
        <ListNavRow
          label={account.unlimited ? t("admin.unexempt") : t("admin.exempt")}
          onClick={() => setPending(account.unlimited ? "unexempt" : "exempt")}
        />
        <ListNavRow
          label={t("admin.revokeAccess")}
          tone="destructive"
          onClick={() => setPending("revoke_access")}
        />
      </ListSection>
      <ListSection header={t("admin.history")}>
        {account.actions.length ? (
          account.actions.map((action) => actionRow(action, false))
        ) : (
          <ListRow label={t("admin.noHistory")} />
        )}
      </ListSection>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        tone={
          pending === "enable" || pending === "unexempt" ? "default" : "danger"
        }
        title={confirm ? t(confirm.title) : ""}
        description={confirm ? t(confirm.description) : ""}
        confirmLabel={confirm ? t(confirm.label) : undefined}
        onConfirm={() => (pending ? run(pending) : undefined)}
      />
    </div>
  );
}
