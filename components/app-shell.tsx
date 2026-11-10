import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  Books,
  ChartDonut,
  Lightning,
  SunHorizon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import Link from "@/components/ui/app-link";
import { useAppRouter } from "@/lib/use-app-router";
import { commitRouteHistory } from "@/lib/navigation-memory";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { useUIStore } from "@/stores/ui-store";
import { SettingsDialog } from "@/components/redesign/settings-dialog";
import { FocusCanvas } from "@/components/home/focus-canvas";
const destinations = [
  ["/app", "redesign.today", SunHorizon],
  ["/app/library", "redesign.library", Books],
  ["/app/progress", "redesign.progress", ChartDonut],
  ["/app/rooms", "redesign.rooms", Lightning],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const router = useAppRouter();
  const { resolvedTheme } = useTheme();
  const active = useUIStore((s) => s.practiceActive);
  const user = useCloudStore((s) => s.user);
  const [settings, setSettings] = useState(false);
  const legacySettings =
    pathname === "/app/me" ||
    pathname.startsWith("/app/me/") ||
    pathname === "/app/sync";
  const query = new URLSearchParams(search);
  const group =
    query.get("nav") ??
    (pathname.endsWith("/agents")
      ? "agent"
      : pathname.endsWith("/data")
        ? "data"
        : pathname.endsWith("/preferences")
          ? "study"
          : pathname.endsWith("/admin")
            ? "admin"
            : "account");
  const focus =
    active ||
    pathname === "/app/result" ||
    (pathname === "/app/practice" && query.get("run") === "1") ||
    (pathname.startsWith("/app/rooms/") && query.get("state") === "game");
  const current = /^\/app\/(sets|questions|shared)/.test(pathname)
    ? "/app/library"
    : pathname.startsWith("/app/rooms")
      ? "/app/rooms"
      : pathname === "/app/progress" || pathname === "/app/library"
        ? pathname
        : "/app";
  const displayName = user?.displayName || t("me.guestName");
  useEffect(() => {
    commitRouteHistory(pathname);
  }, [pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = "pine";
    document.documentElement.dataset.scheme =
      new URLSearchParams(search).get("scheme") ?? resolvedTheme ?? "light";
  }, [resolvedTheme, search]);
  useEffect(() => {
    document.body.toggleAttribute("data-focus", focus);
    return () => document.body.removeAttribute("data-focus");
  }, [focus]);
  const close = () => {
    setSettings(false);
    if (legacySettings || query.get("sheet") === "me") router.replace("/app");
  };
  return (
    <div className="app">
      <nav className="side" aria-label={t("redesign.navigation")}>
        <div className="brand">
          <img src="/icons/lexiro.png" alt="" />
          Lexiro
        </div>
        {destinations.map(([href, label, Icon]) => (
          <Link
            key={href}
            className="nav"
            href={href}
            aria-current={current === href ? "page" : undefined}
          >
            <Icon weight="regular" />
            {t(label)}
          </Link>
        ))}
        <button
          className="me-btn"
          onClick={() => setSettings(true)}
          aria-label={t("redesign.settings")}
        >
          <span className="avatar">{displayName[0]}</span>
          <b className="grow cut">{displayName}</b>
          <span className="sync-dot" />
        </button>
      </nav>
      <main className="main">
        {legacySettings ? (
          <>
            <header className="bar-top">
              <h1 className="t-page">{t("redesign.today")}</h1>
            </header>
            <FocusCanvas />
          </>
        ) : (
          children
        )}
      </main>
      {destinations.some(([href]) => pathname === href) && <nav className="dock frost" aria-label={t("redesign.library")}>
        {destinations.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-label={t(label)}
            aria-current={current === href ? "page" : undefined}
          >
            <Icon weight="regular" />
          </Link>
        ))}
      </nav>}
      <SettingsDialog
        open={settings || legacySettings || query.get("sheet") === "me"}
        onClose={close}
        initialGroup={group}
      />
    </div>
  );
}
