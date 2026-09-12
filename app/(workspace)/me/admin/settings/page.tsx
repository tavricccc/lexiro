import { AdminSettings } from "@/components/me/admin-settings";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function AdminSettingsPage() {
  return (
    <MeSubpage parentHref="/me/admin" parentLabel={t("managed.admin")} title={t("admin.settings")}>
      <AdminSettings />
    </MeSubpage>
  );
}
