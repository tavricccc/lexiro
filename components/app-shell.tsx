"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  commitRouteHistory,
  markPopstateRouteDirection,
  adoptedParent,
  isRootRoute,
  PRIMARY_DESTINATIONS,
  type PrimaryDestination,
} from "@/lib/navigation-memory";
import { RouteSurface } from "@/components/motion/route-surface";
import { LiquidNav, type LiquidNavItem } from "@/components/liquid-nav";
import { Icons } from "@/components/ui/icons";
import { SyncIndicator } from "@/components/sync-indicator";
import { useUIStore } from "@/stores/ui-store";

// The order and the routes belong to navigation-memory; this is only how each
// destination is spelled and drawn.
const presentation: Record<
  PrimaryDestination,
  { icon: typeof Icons.practice; label: TranslationKey }
> = {
  "/app": { icon: Icons.today, label: "nav.study" },
  "/app/library": { icon: Icons.library, label: "nav.library" },
  "/app/progress": { icon: Icons.stats, label: "nav.progress" },
  "/app/me": { icon: Icons.account, label: "nav.me" },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const practiceActive = useUIStore((store) => store.practiceActive);
  const showMobileNavigation = !practiceActive && isRootRoute(pathname);
  const navigationPathname = adoptedParent(pathname) ?? pathname;

  React.useEffect(() => commitRouteHistory(pathname), [pathname]);

  React.useEffect(() => {
    const markHistoryTraversal = (event: PopStateEvent) =>
      markPopstateRouteDirection(event.state, window.location.pathname);
    window.addEventListener("popstate", markHistoryTraversal);
    return () => window.removeEventListener("popstate", markHistoryTraversal);
  }, []);

  const navItems = React.useMemo<LiquidNavItem[]>(
    () =>
      PRIMARY_DESTINATIONS.map((destination) => {
        const { icon: Icon, label } = presentation[destination.href];
        return {
          ...destination,
          icon: <Icon className="size-[1.125rem]" />,
          label: t(label),
        };
      }),
    [],
  );

  return (
    <div
      className="app-shell min-h-[100dvh] bg-[var(--surface-stage)]"
      data-focus={practiceActive}
    >
      <aside className="workspace-sidebar hidden md:flex">
        <div className="workspace-brand">{t("app.name")}</div>
        <LiquidNav
          className="workspace-sidebar-links"
          items={navItems}
          pathname={navigationPathname}
          vertical
        />
        <div className="workspace-sidebar-status">
          <SyncIndicator />
        </div>
      </aside>

      <div className="workspace-body min-w-0">
        <main
          className={`app-viewport pt-[max(0.75rem,var(--safe-top))] md:pb-6 md:pt-4 ${
            showMobileNavigation
              ? "pb-[calc(var(--mobile-nav-height)+var(--mobile-nav-bottom-gap)+1.5rem)]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          <RouteSurface>{children}</RouteSurface>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full bg-card px-3 py-1.5 shadow-[var(--shadow-floating)] md:hidden"
          data-visible={showMobileNavigation}
          inert={!showMobileNavigation}
        >
          <LiquidNav
            className="mx-auto h-12"
            items={navItems}
            pathname={navigationPathname}
          />
        </div>
      </div>
    </div>
  );
}
