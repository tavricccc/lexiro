import { AdminUsage } from "@/components/me/admin-usage";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function AdminUsagePage() {
  return (
    <MeSubpage parentHref="/me/admin" parentLabel={t("managed.admin")} title={t("admin.usage")}>
      <AdminUsage />
    </MeSubpage>
  );
}
