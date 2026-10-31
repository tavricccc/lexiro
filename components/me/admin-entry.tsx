import { useIsAdministrator } from "@/components/me/use-is-administrator";
import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

/** The way into 管理員, drawn only for an account the Worker calls an administrator. */
export function AdminEntry() {
  if (!useIsAdministrator()) return null;
  return (
    <ListSection className="section-gap">
      <ListNavRow
        href="/app/me/admin"
        icon={Icons.admin}
        label={t("admin.title")}
        detail={t("admin.entryHint")}
      />
    </ListSection>
  );
}
