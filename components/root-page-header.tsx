import type { ReactNode } from "react";
import Link from "@/components/ui/app-link";
import { useCloudStore } from "@/stores/cloud-store";
import { t } from "@/lib/i18n";
export function RootPageHeader({
  actions,
  className = "",
  title,
}: {
  actions?: ReactNode;
  className?: string;
  title: string;
}) {
  const name = useCloudStore((s) => s.user?.displayName) || t("me.guestName");
  return (
    <header className={`bar-top ${className}`}>
      <h1 className="t-page">{title}</h1>
      <div className="acts">
        {actions}
        <Link
          className="btn btn-icon btn-glass only-phone"
          href="/app/me"
          aria-label={t("redesign.settings")}
        >
          <span className="avatar">{name[0]}</span>
        </Link>
      </div>
    </header>
  );
}
