import { AdminAccountList } from "@/components/me/admin-accounts";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function AdminAccountsPage() {
  return (
    <MeSubpage parentHref="/app/me/admin" parentLabel={t("managed.admin")} title={t("admin.accounts")}>
      <AdminAccountList />
    </MeSubpage>
  );
}
