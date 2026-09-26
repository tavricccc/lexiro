"use client";

import { AccountRow } from "@/components/me/account-row";
import { useManagedAccount } from "@/components/ai/use-managed-account";
import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { RootPageHeader } from "@/components/root-page-header";
import { t } from "@/lib/i18n";

/**
 * 我的 is a column of grouped lists, one screen wide even on a desktop.
 *
 * It used to be a two-column page of labelled form fields, which on a phone
 * collapsed into a stack of boxes with headings — a web form. Settings are a
 * list: each line says what it is and what it is set to, and the column stays
 * narrow because a row whose label and value are half a screen apart is no
 * longer one line of reading.
 */
export function MePage() {
  const account = useManagedAccount();
  return (
    <div className="mx-auto max-w-2xl space-y-9 pb-4">
      <RootPageHeader title={t("me.title")} />
      <AccountRow />
      <ListSection>
        <ListNavRow
          href="/app/me/preferences"
          icon={Icons.settings}
          label={t("me.preferences")}
        />
        <ListNavRow
          href="/app/me/plan"
          icon={Icons.credit}
          label={t("managed.planTitle")}
          value={
            account.data?.admin
              ? t("admin.unlimited")
              : account.data
                ? t("managed.points", { points: account.data.points })
                : undefined
          }
        />
        <ListNavRow
          href="/app/me/data"
          icon={Icons.backup}
          label={t("settings.data")}
        />
        {account.data?.admin && (
          <ListNavRow
            href="/app/me/admin"
            icon={Icons.admin}
            label={t("managed.admin")}
          />
        )}
      </ListSection>
    </div>
  );
}
