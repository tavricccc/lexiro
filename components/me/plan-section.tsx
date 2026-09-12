"use client";

import { useManagedAccount } from "@/components/ai/use-managed-account";
import { MeSection } from "@/components/me/me-section";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { AdminPanel } from "@/components/me/admin-panel";

export function PlanSection() {
  const user = useCloudStore((store) => store.user);
  const account = useManagedAccount();
  return (
    <>
      <MeSection
        icon={Icons.ai}
        title={t("managed.planTitle")}
        description={t("managed.planDescription")}
      >
        {!user ? (
          <p className="text-sm text-muted-foreground">
            {t("managed.signInRequired")}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="break-all text-xs text-muted-foreground">
              {t("managed.accountId")}: {user.uid}
            </p>
            {account.isPending && <p role="status">{t("common.loading")}</p>}
            {account.error && (
              <div role="alert">
                <p className="text-sm text-destructive">
                  {account.error.message}
                </p>
                <Button variant="ghost" onClick={() => void account.refetch()}>
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {account.data && (
              <>
                <p className="text-xl font-medium tabular-nums">
                  {t("managed.balance", { points: account.data.points })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {account.data.monthly > 0
                    ? t("managed.monthly", { points: account.data.monthly })
                    : t("managed.oneTime")}
                </p>
                {account.data.renews_at && (
                  <p className="text-sm text-muted-foreground">
                    {t("managed.renewsAt", {
                      date: new Date(
                        account.data.renews_at * 1000,
                      ).toLocaleDateString("zh-TW"),
                    })}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </MeSection>
      {account.data?.admin && <AdminPanel />}
    </>
  );
}
