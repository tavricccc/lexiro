import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Books, ChartLineUp, House, Sword, UserCircle } from "@phosphor-icons/react";
import { AppLink, PrimaryNav, cn, routeMotion, type NavItem } from "design-kit";
import { useAnswerFlush } from "@/data/learning";
import { useRevisionWatch } from "@/data/queries";
import { useThemeSync } from "@/data/prefs";
import { Brand } from "@/ui/brand";
import { screenKey, travelDirection } from "./hierarchy";
import { lastPopFromSystem } from "./navigation";
import { OfflineBanner } from "@/ui/offline-banner";

const NAV: NavItem[] = [
  { href: "/app", icon: House, label: "今天" },
  { href: "/app/library", icon: Books, label: "單字" },
  { href: "/app/progress", icon: ChartLineUp, label: "進度" },
  { href: "/app/rooms", icon: Sword, label: "對戰" },
  { href: "/app/me", icon: UserCircle, label: "我" },
];

/** The destination a path belongs to; the deepest prefix wins. */
export function activeDestination(pathname: string): string | null {
  if (pathname.startsWith("/app/sets") || pathname.startsWith("/app/library")) return "/app/library";
  const match = NAV.filter((item) => item.href !== "/app" && pathname.startsWith(item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? (pathname === "/app" ? "/app" : null);
}

/** Screens that take the whole screen: a practice round and a live room. */
const immersive = (pathname: string) => pathname.startsWith("/app/practice/run") || /^\/app\/rooms\/[^/]+/.test(pathname);

/** Only the five destinations show the mobile bottom bar; deeper pages lead back with their own header control. */
const isDestination = (pathname: string) => NAV.some((item) => item.href === pathname);

export function WorkspaceShell() {
  const { pathname } = useLocation();
  useRevisionWatch(true);
  useAnswerFlush(true);
  useThemeSync();
  const active = activeDestination(pathname);
  const full = immersive(pathname);
  return (
    <div className="min-h-svh">
      {!full ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r-2 border-line-strong bg-surface md:flex lg:w-64">
          <div className="border-b border-line px-5 py-6">
            <AppLink className="inline-block outline-none focus-visible:ring-2 focus-visible:ring-contrast" href="/app">
              <Brand />
            </AppLink>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <p className="mb-2 px-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">INDEX</p>
            <PrimaryNav activeHref={active} items={NAV} label="主要導覽" variant="rail" />
          </div>
          <div className="border-t-2 border-line-strong p-4">
            <AppLink
              className="group flex items-center justify-between border border-line-strong bg-ink px-4 py-3 text-sm font-bold text-surface transition-colors hover:border-contrast hover:bg-contrast hover:text-on-contrast focus-visible:ring-2 focus-visible:ring-contrast"
              href="/app/practice"
            >
              <span>練習工作台</span>
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" weight="bold" />
            </AppLink>
          </div>
        </aside>
      ) : null}
      <main className={full ? "" : "md:pl-56 lg:pl-64"}>
        <OfflineBanner />
        <div className={full ? "" : "mx-auto w-full max-w-[1440px] px-[var(--gutter)] pb-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+2.5rem)] pt-[calc(var(--safe-top)+1.25rem)] md:px-10 md:pb-16 md:pt-9 lg:px-12"}>
          <Screens pathname={pathname} />
        </div>
      </main>
      {!full ? (
        <div
          aria-hidden={!isDestination(pathname)}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 bg-surface pb-[var(--safe-bottom)] transition-transform duration-[var(--motion-nav)] ease-[var(--ease-nav)] md:hidden",
            isDestination(pathname) ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          inert={!isDestination(pathname)}
        >
          <PrimaryNav activeHref={active} items={NAV} label="主要導覽" variant="dock" />
        </div>
      ) : null}
    </div>
  );
}

function Screens({ pathname: current }: { pathname: string }) {
  const pathname = screenKey(current);
  const outlet = useOutlet();
  const reduced = useReducedMotion();
  const [last, setLast] = useState({ pathname, direction: 0 as -1 | 0 | 1 });
  if (last.pathname !== pathname) setLast({ pathname, direction: travelDirection(last.pathname, pathname) });
  const direction = reduced ? 0 : last.direction;
  const scroll = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    window.scrollTo(0, scroll.current.get(pathname) ?? 0);
    const remember = () => scroll.current.set(pathname, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [pathname]);
  return (
    <motion.div key={pathname} {...routeMotion(direction)} {...(lastPopFromSystem ? { initial: false } : {})}>
      {outlet}
    </motion.div>
  );
}
