import { useEffect, useState, type ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/page-state";
import { SearchField } from "@/components/ui/search-field";
import { SignInRequired } from "@/components/ui/sign-in-required";
import {
  ADMIN_ACCOUNT_VIEWS,
  actionLabel,
  adminApi,
  alertText,
  formatBytes,
  formatCount,
  formatTime,
  percent,
  quotaLabel,
  VIEW_LABELS,
  type AdminAccount,
  type AdminAccountView,
  type AdminAction,
} from "@/lib/admin-client";
import { t } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";
import { useCloudStore } from "@/stores/cloud-store";

const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : t("agent.requestFailed");

/**
 * Keeps an admin screen behind the Worker's answer: a page drawn before it
 * would show controls the Worker refuses anyway.
 */
export function AdminGate({
  back,
  title,
  children,
}: {
  back: string;
  title: string;
  children: ReactNode;
}) {
  const uid = useCloudStore((store) => store.user?.uid ?? null);
  const ready = useCloudStore((store) => store.ready);
  const { admin, checkedAt, refresh } = useAdminStore();
  const owner = useAdminStore((store) => store.uid);
  useEffect(() => {
    void refresh(uid);
  }, [refresh, uid]);
  const header = (
    <PageHeader back={<BackControl href={back} />} title={title} />
  );
  if (ready && !uid)
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <SignInRequired message={t("agent.signInRequired")} />
      </div>
    );
  if (!admin)
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        {owner === uid && checkedAt ? (
          <EmptyState
            title={t("admin.title")}
            description={t("admin.notAdmin")}
          />
        ) : (
          <LoadingState />
        )}
      </div>
    );
  return <>{children}</>;
}

export function AdminPage() {
  return (
    <AdminGate back="/app/me" title={t("admin.title")}>
      <AdminOverview />
    </AdminGate>
  );
}

function AdminOverview() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <PageHeader
        back={<BackControl href="/app/me" />}
        title={t("admin.title")}
      />
      <ServiceSection />
      <AccountsSection />
      <HistorySection />
    </div>
  );
}

function ServiceSection() {
  const status = useAdminStore((store) => store.status);
  const setStatus = useAdminStore((store) => store.setStatus);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const paused = status?.agentPaused ?? null;

  const check = () => {
    setChecking(true);
    setError("");
    void adminApi
      .checkUsage()
      .then(setStatus, (reason) => setError(message(reason)))
      .finally(() => setChecking(false));
  };

  return (
    <>
      {status?.alerts.length ? (
        <ListSection header={t("admin.service")}>
          {status.alerts.map((alert) => (
            <ListRow
              key={`${alert.code}:${"quota" in alert ? alert.quota : ""}`}
              icon={Icons.error}
              label={alertText(alert)}
              tone="destructive"
            />
          ))}
        </ListSection>
      ) : null}
      <ListSection
        header={
          status?.usage
            ? t("admin.usageToday", { day: status.usage.day })
            : t("admin.service")
        }
        headerAction={
          <Button variant="ghost" size="sm" disabled={checking} onClick={check}>
            <Icons.refresh />
            {checking ? t("admin.checking") : t("admin.checkNow")}
          </Button>
        }
        footer={
          error ||
          (status?.usage
            ? t("admin.checkedAt", { time: formatTime(status.usage.checkedAt) })
            : t("admin.usageNever"))
        }
      >
        {status?.usage?.quotas.map((quota) => (
          <ListRow
            key={quota.name}
            label={quotaLabel(quota.name)}
            value={`${formatCount(quota.used)} / ${formatCount(quota.limit)}（${percent(quota.used / quota.limit)}）`}
            tone={quota.used / quota.limit >= 0.7 ? "destructive" : "default"}
          />
        ))}
        <ListRow
          label={t("admin.agent")}
          value={
            paused
              ? t(
                  paused.manual
                    ? "admin.agentPausedManual"
                    : "admin.agentPausedAuto",
                )
              : t("admin.agentRunning")
          }
        />
        <ListNavRow
          label={paused ? t("admin.resumeAgent") : t("admin.pauseAgent")}
          tone={paused ? "brand" : "destructive"}
          onClick={() => setConfirm(true)}
        />
      </ListSection>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone={paused ? "default" : "danger"}
        title={paused ? t("admin.resumeTitle") : t("admin.pauseTitle")}
        description={
          paused ? t("admin.resumeDescription") : t("admin.pauseDescription")
        }
        confirmLabel={paused ? t("admin.resumeAgent") : t("admin.pauseAgent")}
        onConfirm={async () =>
          setStatus(await adminApi.setAgentPaused(!paused))
        }
      />
    </>
  );
}

/** One account in a list: who it is, and what it spent today. */
export function accountSummary(account: AdminAccount) {
  return {
    label: account.email ?? account.uid,
    detail: [
      t("admin.rowStats", {
        writes: formatCount(account.writesToday),
        reads: formatCount(account.readsToday),
        bytes: formatBytes(account.storedBytes),
      }),
      account.seenDay ? t("admin.seen", { day: account.seenDay }) : "",
    ]
      .filter(Boolean)
      .join("・"),
    value: [
      account.disabled ? t("admin.badgeDisabled") : "",
      account.unlimited ? t("admin.badgeUnlimited") : "",
    ]
      .filter(Boolean)
      .join("・"),
  };
}

function AccountsSection() {
  const [view, setView] = useState<AdminAccountView>("recent");
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Typing waits a moment so each keystroke is not a request.
    const timer = window.setTimeout(
      () => {
        setError("");
        void adminApi.accounts({ view, query }, controller.signal).then(
          (found) => {
            if (!controller.signal.aborted) setAccounts(found.accounts);
          },
          (reason) => {
            if (!controller.signal.aborted) setError(message(reason));
          },
        );
      },
      query ? 350 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [view, query, attempt]);

  return (
    <section className="space-y-3">
      <h2 className="type-list-header px-1">{t("admin.accounts")}</h2>
      <SearchField
        label={t("admin.search")}
        value={query}
        onValueChange={setQuery}
      />
      {!query && (
        <LiquidTabs
          ariaLabel={t("admin.accounts")}
          value={view}
          onValueChange={(next) => {
            setAccounts(null);
            setView(next as AdminAccountView);
          }}
          options={ADMIN_ACCOUNT_VIEWS.map((value) => ({
            value,
            label: t(VIEW_LABELS[value]),
          }))}
        />
      )}
      {error ? (
        <ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : accounts === null ? (
        <LoadingState rows={3} />
      ) : (
        <ListSection>
          {accounts.length ? (
            accounts.map((account) => (
              <ListNavRow
                key={account.uid}
                href={`/app/admin/accounts/${encodeURIComponent(account.uid)}`}
                {...accountSummary(account)}
              />
            ))
          ) : (
            <ListRow label={t("admin.noAccounts")} />
          )}
        </ListSection>
      )}
    </section>
  );
}

/** One line of the audit trail. */
export function actionRow(action: AdminAction, showTarget: boolean) {
  return (
    <ListRow
      key={action.id}
      label={
        showTarget && action.targetUid
          ? `${actionLabel(action.action)}・${action.targetUid}`
          : actionLabel(action.action)
      }
      detail={[action.adminEmail, action.detail].filter(Boolean).join("・")}
      value={formatTime(action.at)}
    />
  );
}

function HistorySection() {
  const [actions, setActions] = useState<AdminAction[] | null>(null);
  const status = useAdminStore((store) => store.status);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi.actions(controller.signal).then(
      (found) => {
        if (!controller.signal.aborted) setActions(found.actions);
      },
      () => {
        if (!controller.signal.aborted) setActions([]);
      },
    );
    return () => controller.abort();
    // A pause or resume changes the status and adds a line here.
  }, [status?.agentPaused?.since, status?.agentPaused?.manual]);
  if (actions === null) return null;
  return (
    <ListSection header={t("admin.history")}>
      {actions.length ? (
        actions.map((action) => actionRow(action, true))
      ) : (
        <ListRow label={t("admin.noHistory")} />
      )}
    </ListSection>
  );
}
