import { AdminPanel } from "@/components/me/admin-panel";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function AdminPage() {
  return (
    <MeSubpage title={t("managed.admin")}>
      <AdminPanel />
    </MeSubpage>
  );
}
