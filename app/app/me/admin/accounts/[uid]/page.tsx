import { AdminAccountEditor } from "@/components/me/admin-accounts";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default async function AdminAccountPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  return (
    <MeSubpage parentHref="/app/me/admin/accounts" parentLabel={t("admin.accounts")} title={t("admin.editAccount")}>
      <AdminAccountEditor accountUid={uid} />
    </MeSubpage>
  );
}
