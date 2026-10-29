import { AccountRow } from "@/components/me/account-row";
import { AppUpdateSection } from "./app-update-section";
import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { RootPageHeader } from "@/components/root-page-header";
import { t } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";

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
  // Known once the admin banner has asked the Worker; others never see it.
  const admin = useAdminStore((store) => store.admin);
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <RootPageHeader title={t("me.title")} />
      <AccountRow />
      <ListSection className="section-gap">
        <ListNavRow
          href="/app/me/preferences"
          icon={Icons.settings}
          label={t("me.preferences")}
        />
        <ListNavRow
          href="/app/me/data"
          icon={Icons.backup}
          label={t("settings.data")}
        />
        <ListNavRow
          href="/app/me/agents"
          icon={Icons.ai}
          label={t("agent.connections")}
          detail={t("agent.connectionsHint")}
        />
        {admin && (
          <ListNavRow
            href="/app/admin"
            icon={Icons.admin}
            label={t("admin.title")}
            detail={t("admin.hint")}
          />
        )}
      </ListSection>
      <AppUpdateSection />
    </div>
  );
}
