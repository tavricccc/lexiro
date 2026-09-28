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
      {!practiceActive && (
        <header className="workspace-navigation hidden md:flex">
          <LiquidNav
            className="workspace-navigation-links"
            items={navItems}
            pathname={navigationPathname}
          />
          <SyncIndicator />
        </header>
      )}

      <div className="min-w-0">
        <main
          className={`app-viewport pt-[max(0.75rem,var(--safe-top))] md:pb-12 md:pt-6 ${
            showMobileNavigation
              ? "pb-[calc(6.5rem+min(0.625rem,var(--safe-bottom)))]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          <RouteSurface>{children}</RouteSurface>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 px-3 py-1.5 md:hidden"
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
