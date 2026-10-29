import { useEffect } from "react";
import { useLocation } from "react-router";

import Link from "@/components/ui/app-link";
import { Icons } from "@/components/ui/icons";
import { alertText } from "@/lib/admin-client";
import { t } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";
import { useCloudStore } from "@/stores/cloud-store";

/**
 * The only place a quota alert reaches an admin: nothing is mailed, so the
 * first alert sits above every screen until it clears. Other accounts ask the
 * Worker once, get told they are not an admin, and never see it.
 */
export function AdminBanner() {
  const uid = useCloudStore((store) => store.user?.uid ?? null);
  const admin = useAdminStore((store) => store.admin);
  const alerts = useAdminStore((store) => store.status?.alerts);
  const refresh = useAdminStore((store) => store.refresh);
  const { pathname } = useLocation();

  useEffect(() => {
    void refresh(uid);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh(uid);
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh, uid]);

  // The admin page lists every alert itself.
  if (!admin || !alerts?.length || pathname.startsWith("/app/admin"))
    return null;
  return (
    <div
      role="alert"
      className="rule-card mx-auto mb-4 flex max-w-2xl items-start gap-3 py-3 text-warning"
    >
      <Icons.error aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-6 [overflow-wrap:anywhere]">
        {alertText(alerts[0])}
        {alerts.length > 1 && (
          <span className="text-muted-foreground">
            {" "}
            {t("admin.bannerMore", { count: alerts.length - 1 })}
          </span>
        )}
      </p>
      <Link
        href="/app/admin"
        className="shrink-0 text-sm font-semibold text-primary"
      >
        {t("admin.bannerOpen")}
      </Link>
    </div>
  );
}
