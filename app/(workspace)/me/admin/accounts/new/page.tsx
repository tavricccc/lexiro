import { AdminAccountEditor } from "@/components/me/admin-accounts";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function CreateAdminAccountPage() {
  return (
    <MeSubpage parentHref="/me/admin/accounts" parentLabel={t("admin.accounts")} title={t("admin.create")}>
      <AdminAccountEditor />
    </MeSubpage>
  );
}
