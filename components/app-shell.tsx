"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  commitRouteHistory,
  markPopstateRouteDirection,
} from "@/lib/navigation-memory";
import { RouteSurface } from "@/components/motion/route-surface";
import { LiquidNav, type LiquidNavItem } from "@/components/liquid-nav";
import { BrandLockup } from "@/components/ui/brand";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SyncIndicator } from "@/components/sync-indicator";
import { useUIStore } from "@/stores/ui-store";

// 今天 opens both kinds of practice with a count beside each, so 練習 is a screen
// you arrive at rather than a place you go: it keeps its route for every link
// that starts a session, but not a slot in the navigation.
const destinations = [
  {
    href: "/",
    activePathPrefix: "/practice",
    label: "nav.study",
    icon: Icons.today,
  },
  { href: "/library", label: "nav.library", icon: Icons.library },
  { href: "/progress", label: "nav.progress", icon: Icons.stats },
  { href: "/me", label: "nav.me", icon: Icons.account },
] satisfies {
  href: string;
  activePathPrefix?: string;
  label: TranslationKey;
  icon: typeof Icons.practice;
}[];

function isSecondaryMobileRoute(pathname: string) {
  if (pathname.startsWith("/sets/") || pathname === "/sets/new") return true;
  if (/^\/questions\/.+/.test(pathname)) return true;
  return false;
}

function fallbackPageTitle(pathname: string) {
  if (pathname === "/library") return t("library.title");
  if (pathname === "/progress") return t("progress.title");
  if (pathname === "/me") return t("me.title");
  if (pathname === "/sync") return t("sync.title");
  if (pathname === "/practice") return t("practice.title");
  if (pathname === "/sets/new") return t("setEditor.createTitle");
  if (pathname === "/questions/generate") return t("questions.generateTitle");
  if (pathname.startsWith("/questions/reading/")) return t("questions.editReading");
  if (pathname.startsWith("/questions/")) return t("questions.edit");
  if (pathname.startsWith("/sets/")) return t("library.title");
  return t("app.name");
}

function ShellIdentity({ pathname, title }: { pathname: string; title: string }) {
  if (pathname === "/") return <BrandLockup href="/" />;
  return <h1 className="truncate text-lg font-medium leading-none tracking-[-0.01em]">{title}</h1>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const practiceActive = useUIStore((store) => store.practiceActive);
  const pageTitle = useUIStore((store) => store.pageTitle);
  const showMobileNavigation = !practiceActive && !isSecondaryMobileRoute(pathname);
  const shellTitle = pageTitle?.pathname === pathname ? pageTitle.title : fallbackPageTitle(pathname);

  React.useEffect(() => commitRouteHistory(pathname), [pathname]);

  React.useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  React.useEffect(() => {
    const markHistoryTraversal = (event: PopStateEvent) =>
      markPopstateRouteDirection(event.state, window.location.pathname);
    window.addEventListener("popstate", markHistoryTraversal);
    return () => window.removeEventListener("popstate", markHistoryTraversal);
  }, []);

  const navItems = React.useMemo<LiquidNavItem[]>(
    () =>
      destinations.map((d) => ({
        href: d.href,
        activePathPrefix: d.activePathPrefix,
        icon: <d.icon className="size-[1.125rem]" />,
        label: t(d.label),
      })),
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
      {!practiceActive && <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-[var(--surface-stage)]/92 p-3 backdrop-blur-xl md:flex">
        <div className="flex items-center justify-between px-2 pb-5 pt-2">
          <ShellIdentity pathname={pathname} title={shellTitle} />
          <SyncIndicator />
        </div>
        <LiquidNav
          className="flex-1 content-start"
          items={navItems}
          pathname={pathname}
          vertical
        />
      </aside>}

      <div className={cn("min-w-0", !practiceActive && "md:col-start-2")}>
        <div aria-hidden className="app-top-blur" data-visible={scrolled} />
        <main
          className={`app-viewport pt-[max(1rem,var(--safe-top))] md:pb-12 md:pt-6 ${
            showMobileNavigation
              ? "pb-[calc(6.5rem+min(0.625rem,var(--safe-bottom)))]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          {showMobileNavigation && (
            <div className="app-mobile-header mb-4 flex h-10 items-center justify-between md:hidden">
              <ShellIdentity pathname={pathname} title={shellTitle} />
              <div className="flex items-center gap-1">
                <SyncIndicator />
              </div>
            </div>
          )}
          <RouteSurface>{children}</RouteSurface>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full border bg-background/92 px-3 py-1.5 shadow-[var(--shadow-floating)] backdrop-blur-xl md:hidden"
          data-visible={showMobileNavigation}
          inert={!showMobileNavigation}
        >
          <LiquidNav
            className="mx-auto h-12"
            items={navItems}
            pathname={pathname}
          />
        </div>
      </div>
    </div>
  );
}
