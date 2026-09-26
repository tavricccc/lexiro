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
import { BrandLockup } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
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
      className={cn(
        "app-shell min-h-[100dvh] bg-[var(--surface-stage)]",
        !practiceActive && "md:grid md:grid-cols-[15rem_minmax(0,1fr)]",
      )}
      data-focus={practiceActive}
    >
      {!practiceActive && <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card p-3 md:flex">
        <div className="mb-4 flex items-center justify-between border-b px-3 pb-5 pt-3">
          <BrandLockup href="/app" />
          <SyncIndicator />
        </div>
        <LiquidNav
          className="flex-1 content-start"
          items={navItems}
          pathname={navigationPathname}
          vertical
        />
      </aside>}

      <div className={cn("min-w-0", !practiceActive && "md:col-start-2")}>
        <main
          className={`app-viewport pt-[max(1rem,var(--safe-top))] md:pb-12 md:pt-6 ${
            showMobileNavigation
              ? "pb-[calc(6.5rem+min(0.625rem,var(--safe-bottom)))]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          {/* No brand row on a phone: each destination's own title bar carries
              the mark and the sync status, in the row that holds its title. */}
          <RouteSurface>{children}</RouteSurface>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full border px-3 py-1.5 shadow-[var(--shadow-floating)] md:hidden"
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
