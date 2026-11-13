import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Books, ChartLineUp, House, Sword, UserCircle } from "@phosphor-icons/react";
import { EdgeBlur, PrimaryNav, cn, routeMotion, type NavItem } from "design-kit";
import { useAnswerFlush } from "@/data/learning";
import { useRevisionWatch } from "@/data/queries";
import { useThemeSync } from "@/data/prefs";
import { Brand } from "@/ui/brand";
import { travelDirection } from "./hierarchy";
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

/** Only the five destinations show the dock; deeper pages lead back with their own control. */
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
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-70 flex-col gap-8 px-5 pb-6 pt-8 md:flex">
          <Brand className="px-3.5" />
          <PrimaryNav activeHref={active} items={NAV} label="主要導覽" variant="rail" />
        </aside>
      ) : null}
      <main className={full ? "" : "md:pl-70"}>
        <OfflineBanner />
        <div className={full ? "" : "mx-auto w-full max-w-3xl px-[var(--gutter)] pb-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+2rem)] pt-[calc(var(--safe-top)+1.5rem)] md:px-10 md:pb-16 md:pt-10"}>
          <Screens pathname={pathname} />
        </div>
      </main>
      {/* Content passing either edge softens under a progressive blur instead of being cut off. */}
      <EdgeBlur className="h-[calc(var(--safe-top)+5rem)] md:left-70 md:h-20" side="top" />
      {!full ? <EdgeBlur className={isDestination(pathname) ? "h-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+1.5rem)] md:left-70 md:h-16" : "h-[calc(var(--safe-bottom)+2rem)] md:left-70 md:h-16"} side="bottom" /> : null}
      {!full ? (
        <div
          aria-hidden={!isDestination(pathname)}
          className={cn("fixed inset-x-0 bottom-[var(--bottom-nav-gap)] z-40 flex justify-center px-[var(--gutter)] transition-[opacity,translate] duration-[var(--motion-nav)] ease-[var(--ease-nav)] md:hidden", isDestination(pathname) ? "" : "pointer-events-none translate-y-[calc(100%+var(--bottom-nav-gap))] opacity-0")}
          inert={!isDestination(pathname)}
        >
          <PrimaryNav activeHref={active} className="w-full max-w-md" items={NAV} label="主要導覽" variant="dock" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The current screen, moving the way its place in the hierarchy says: a
 * child is pushed in from the right, a parent returns from the left, tabs
 * cross-fade. Each screen comes back scrolled where it was left.
 */
function Screens({ pathname }: { pathname: string }) {
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
    <motion.div key={pathname} {...routeMotion(direction)}>
      {outlet}
    </motion.div>
  );
}
