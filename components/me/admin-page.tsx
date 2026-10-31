import { useCallback, useEffect, useState } from "react";

import { MeSubpage } from "@/components/me/me-subpage";
import { Button } from "@/components/ui/button";
import {
  ListActionRow,
  ListInputRow,
  ListRow,
  ListSection,
} from "@/components/ui/list";
import { LoadingState } from "@/components/ui/page-state";
import { agentJson } from "@/lib/agent-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export interface AdminOverview {
  day: string;
  accounts: number;
  activeToday: number;
  writesToday: number;
  readsToday: number;
  storedBytes: number;
  agentPaused: boolean;
  disabled: {
    uid: string;
    email: string;
    name: string;
    reason: string;
    disabledAt: number;
  }[];
  top: AdminAccount[];
}
export interface AdminAccount {
  uid: string;
  email: string;
  name: string;
  writesToday: number;
  storedBytes: number;
  readsToday: number;
  disabled: boolean;
}

/** Name and email lead; the uid stays as the small print that disabling uses. */
function Who({
  account,
}: {
  account: { uid: string; email: string; name: string };
}) {
  return (
    <>
      <p className="type-row break-all">
        {account.name || account.email || account.uid}
      </p>
      {(account.name ? account.email : "") && (
        <p className="type-row-detail break-all">{account.email}</p>
      )}
      {(account.name || account.email) && (
        <p className="type-row-detail break-all font-latin">{account.uid}</p>
      )}
    </>
  );
}

const UID = /^[A-Za-z0-9]{1,128}$/;
const number = (value: number) => value.toLocaleString("en-US");
export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function AccountItem({
  account,
  busy,
  onToggle,
}: {
  account: AdminAccount;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-[var(--row-padding-block)]">
      <div className="min-w-0 flex-1">
        <Who account={account} />
        {account.disabled && (
          <p className="type-row-detail text-destructive">
            {t("admin.disabledBadge")}
          </p>
        )}
        <p className="type-row-detail">
          {t("admin.accountDetail", {
            writes: number(account.writesToday),
            reads: number(account.readsToday),
            size: formatBytes(account.storedBytes),
          })}
        </p>
      </div>
      <Button variant="outline" disabled={busy} onClick={onToggle}>
        {t(account.disabled ? "admin.enable" : "admin.disable")}
      </Button>
    </div>
  );
}

export function AdminPage() {
  const { user, ready } = useCloudStore();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [uid, setUid] = useState("");
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<AdminAccount[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await agentJson<AdminOverview>("/admin/overview"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("agent.requestFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (ready && user) void load();
    else setLoading(!ready);
  }, [ready, user, load]);

  const search = async () => {
    const q = query.trim();
    if (!q) return setFound(null);
    setError("");
    try {
      const result = await agentJson<{ accounts: AdminAccount[] }>(
        `/admin/search?q=${encodeURIComponent(q)}`,
      );
      setFound(result.accounts);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("agent.requestFailed"),
      );
    }
  };

  const change = async (target: string, disable: boolean) => {
    if (disable && !window.confirm(t("admin.disableConfirm", { uid: target })))
      return;
    setBusy(target);
    setError("");
    try {
      await agentJson(
        `/admin/accounts/${encodeURIComponent(target)}/disabled`,
        {
          method: disable ? "PUT" : "DELETE",
          ...(disable ? { body: JSON.stringify({ reason }) } : {}),
        },
      );
      if (disable && target === uid.trim()) {
        setUid("");
        setReason("");
      }
      await load();
      if (query.trim()) await search();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("agent.requestFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const trimmed = uid.trim();
  return (
    <MeSubpage title={t("admin.title")}>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant="glass"
            disabled={loading}
            onClick={() => void load()}
          >
            {t("admin.refresh")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading && !overview ? (
          <LoadingState />
        ) : (
          overview && (
            <>
              <ListSection header={t("admin.overview", { day: overview.day })}>
                <ListRow
                  label={t("admin.accounts")}
                  value={number(overview.accounts)}
                />
                <ListRow
                  label={t("admin.activeToday")}
                  value={number(overview.activeToday)}
                />
                <ListRow
                  label={t("admin.writesToday")}
                  value={number(overview.writesToday)}
                />
                <ListRow
                  label={t("admin.readsToday")}
                  value={number(overview.readsToday)}
                />
                <ListRow
                  label={t("admin.storedBytes")}
                  value={formatBytes(overview.storedBytes)}
                />
                <ListRow
                  label={t("admin.agentPaused")}
                  value={t(
                    overview.agentPaused
                      ? "admin.agentPausedYes"
                      : "admin.agentPausedNo",
                  )}
                />
              </ListSection>
              <ListSection
                header={t("admin.search")}
                footer={found && !found.length ? t("admin.noMatch") : undefined}
              >
                <ListInputRow
                  label={t("admin.searchLabel")}
                  onChange={setQuery}
                  placeholder={t("admin.searchPlaceholder")}
                  value={query}
                />
                <ListActionRow onClick={() => void search()}>
                  {t("admin.searchAction")}
                </ListActionRow>
                {found?.map((account) => (
                  <AccountItem
                    key={account.uid}
                    account={account}
                    busy={busy !== null}
                    onToggle={() => void change(account.uid, !account.disabled)}
                  />
                ))}
              </ListSection>
              <ListSection
                header={t("admin.top")}
                footer={t("admin.topFooter")}
              >
                {overview.top.length ? (
                  overview.top.map((account) => (
                    <AccountItem
                      key={account.uid}
                      account={account}
                      busy={busy !== null}
                      onToggle={() =>
                        void change(account.uid, !account.disabled)
                      }
                    />
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    {t("admin.noAccounts")}
                  </p>
                )}
              </ListSection>
              <ListSection header={t("admin.disabledSection")}>
                {overview.disabled.length ? (
                  overview.disabled.map((account) => (
                    <div
                      key={account.uid}
                      className="flex items-center gap-3 py-[var(--row-padding-block)]"
                    >
                      <div className="min-w-0 flex-1">
                        <Who account={account} />
                        <p className="type-row-detail">
                          {[
                            new Date(account.disabledAt).toLocaleString(
                              "zh-TW",
                            ),
                            account.reason,
                          ]
                            .filter(Boolean)
                            .join("・")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void change(account.uid, false)}
                      >
                        {t("admin.enable")}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    {t("admin.noDisabled")}
                  </p>
                )}
              </ListSection>
              <ListSection header={t("admin.disableByUid")}>
                <ListInputRow
                  label={t("admin.uidLabel")}
                  maxLength={128}
                  onChange={setUid}
                  placeholder={t("admin.uidPlaceholder")}
                  value={uid}
                />
                <ListInputRow
                  label={t("admin.reasonLabel")}
                  maxLength={200}
                  onChange={setReason}
                  placeholder={t("admin.reasonPlaceholder")}
                  value={reason}
                />
                <ListActionRow
                  busy={busy === trimmed}
                  disabled={!UID.test(trimmed) || busy !== null}
                  onClick={() => void change(trimmed, true)}
                  tone="destructive"
                >
                  {t("admin.disable")}
                </ListActionRow>
              </ListSection>
            </>
          )
        )}
      </div>
    </MeSubpage>
  );
}
