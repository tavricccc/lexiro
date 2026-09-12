"use client";

import { useManagedAccount } from "@/components/ai/use-managed-account";
import { AdminPanel } from "@/components/me/admin-panel";
import {
  ListActionRow,
  ListNavRow,
  ListRow,
  ListSection,
} from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function PlanSection() {
  const user = useCloudStore((store) => store.user);
  const account = useManagedAccount();
  const admin = account.data?.admin === true;
  return (
    <>
      <ListSection
        footer={
          admin
            ? t("admin.unlimitedHint")
            : user
              ? t("managed.planDescription")
              : t("managed.signInHint")
        }
        header={t("managed.planTitle")}
      >
        {!user && (
          <ListNavRow href="/sync" label={t("settings.signIn")} />
        )}
        {user && account.isPending && (
          <ListRow label={t("common.loading")} />
        )}
        {user && account.error && (
          <>
            <ListRow label={account.error.message} tone="destructive" />
            <ListActionRow onClick={() => void account.refetch()}>
              {t("common.retry")}
            </ListActionRow>
          </>
        )}
        {/* An administrator has no balance to read, so they are told what they
            have instead of a number that would mean nothing. */}
        {admin && (
          <ListRow
            label={t("managed.allowanceLabel")}
            value={t("admin.unlimited")}
          />
        )}
        {account.data && !admin && (
          <>
            <ListRow
              label={t("managed.pointsLabel")}
              value={String(account.data.points)}
            />
            <ListRow
              label={t("managed.allowanceLabel")}
              value={
                account.data.monthly > 0
                  ? t("managed.monthly", { points: account.data.monthly })
                  : t("managed.oneTime")
              }
            />
            {account.data.renews_at && (
              <ListRow
                label={t("managed.renewsLabel")}
                value={new Date(
                  account.data.renews_at * 1000,
                ).toLocaleDateString("zh-TW")}
              />
            )}
          </>
        )}
      </ListSection>
      {admin && <AdminPanel />}
    </>
  );
}
