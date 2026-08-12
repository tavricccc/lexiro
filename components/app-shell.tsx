"use client";

import { BarChart3, BookOpenText, ChevronLeft, ChevronRight, CircleUserRound, ClipboardCheck, LibraryBig, Settings2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { t, type TranslationKey } from "@/lib/i18n";

const destinations = [
  { href: "/", label: "nav.today", icon: ClipboardCheck },
  { href: "/library", label: "nav.library", icon: LibraryBig },
  { href: "/questions", label: "nav.questions", icon: BookOpenText },
  { href: "/progress", label: "nav.progress", icon: BarChart3 },
  { href: "/settings", label: "nav.settings", icon: Settings2 },
] satisfies { href: string; label: TranslationKey; icon: typeof ClipboardCheck }[];

function isActivePath(pathname: string, href: string) { return href === "/" ? pathname === "/" : pathname.startsWith(href); }

function DesktopNavLink({ destination, expanded, pathname }: { destination: (typeof destinations)[number]; expanded: boolean; pathname: string }) {
  const active = isActivePath(pathname, destination.href);
  const Icon = destination.icon;
  const label = t(destination.label);
  return <Link href={destination.href} title={expanded ? undefined : label} aria-current={active ? "page" : undefined} className={cn("flex h-12 items-center gap-3 overflow-hidden text-sm font-semibold transition-[width,background-color,color,padding] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", expanded ? "w-full rounded-2xl px-3.5" : "w-12 justify-center rounded-full", active ? "bg-brand-soft text-ink shadow-[var(--shadow-control)]" : "text-ink-muted hover:bg-brand-soft hover:text-ink")}><Icon className="size-5 shrink-0 stroke-[1.9]" aria-hidden="true" />{expanded && <span className="truncate">{label}</span>}</Link>;
}

function MobileNavLink({ destination, pathname }: { destination: (typeof destinations)[number]; pathname: string }) {
  const active = isActivePath(pathname, destination.href);
  const Icon = destination.icon;
  return <Link href={destination.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", active ? "bg-brand-soft text-ink shadow-[var(--shadow-control)]" : "text-ink-muted active:bg-brand-soft")}><Icon className="size-[1.125rem] stroke-[1.9]" aria-hidden="true" /><span className="max-w-full truncate text-[0.6875rem] font-bold leading-[1.1rem]">{t(destination.label)}</span></Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const mobileTitle = t(routeTitle(pathname));
  const showBack = isNestedRoute(pathname);

  return (
    <div className="min-h-dvh">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col bg-surface py-4 shadow-[var(--shadow-card)] transition-[width] duration-300 md:flex", expanded ? "w-[17.25rem]" : "w-20")} aria-label={t("common.primaryNavigation")}>
        <div className="relative flex h-12 w-full items-center px-4">
          <Link href="/" className="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl px-2 text-ink hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={t("app.name")}>
            <Image src="/icons/lexiro.png" width={32} height={32} className="size-8 shrink-0 rounded-lg" alt="" priority />
            {expanded && <span className="truncate text-sm font-semibold tracking-[0.015em]">{t("app.name")}</span>}
          </Link>
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={t(expanded ? "common.collapseSidebar" : "common.expandSidebar")} className="absolute right-0 top-1/2 grid size-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-surface text-ink-muted shadow-[var(--shadow-control)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{expanded ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button>
        </div>
        <nav className="mt-7 flex flex-1 flex-col gap-2 px-3" aria-label={t("common.primaryNavigation")}>{destinations.map((destination) => <DesktopNavLink key={destination.href} destination={destination} expanded={expanded} pathname={pathname} />)}</nav>
        <div className="px-3"><Link href="/settings" title={expanded ? undefined : t("common.account")} className={cn("flex h-12 items-center gap-3 overflow-hidden rounded-2xl text-sm text-ink-muted hover:bg-brand-soft hover:text-ink", expanded ? "w-full px-3" : "w-12 justify-center")}><CircleUserRound className="size-5 shrink-0" />{expanded && <span className="truncate">{t("common.account")}</span>}</Link></div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 bg-canvas pt-[env(safe-area-inset-top)] shadow-[0_0.0625rem_0_var(--line)] md:hidden">
        <div className="flex h-11 min-w-0 items-center px-4">
          <div className={cn("grid h-11 place-items-center overflow-hidden transition-[width,opacity,margin]", showBack ? "mr-2 w-11 opacity-100" : "w-0 opacity-0")} aria-hidden={!showBack || undefined}>
            <button type="button" disabled={!showBack} tabIndex={showBack ? undefined : -1} onClick={() => router.push(parentRoute(pathname))} aria-label={t("common.back")} className="grid size-11 place-items-center rounded-full text-ink-muted active:bg-brand-soft"><ChevronLeft className="size-5" /></button>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-[0.01em]">{mobileTitle}</h1>
        </div>
      </header>

      <div className={cn("min-w-0 transition-[margin] duration-300 md:ml-20", expanded && "md:ml-[17.25rem]")}>
        <main className="mx-auto w-full max-w-[80rem] px-4 pb-24 pt-[calc(3.75rem+env(safe-area-inset-top))] sm:px-6 md:px-6 md:pb-8 md:pt-6 lg:px-8">{children}</main>
      </div>

      <nav className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-30 mx-auto grid max-w-md grid-cols-5 rounded-full bg-surface px-3 py-1.5 shadow-[var(--shadow-floating)] md:hidden" aria-label={t("common.primaryNavigation")}>
        {destinations.map((destination) => <MobileNavLink key={destination.href} destination={destination} pathname={pathname} />)}
      </nav>
    </div>
  );
}

function routeTitle(pathname: string): TranslationKey {
  if (pathname.startsWith("/sets") || pathname.startsWith("/dictionary") || pathname.startsWith("/library")) return "nav.library";
  if (pathname.startsWith("/questions")) return "nav.questions";
  if (pathname.startsWith("/progress")) return "nav.progress";
  if (pathname.startsWith("/settings")) return "nav.settings";
  if (pathname.startsWith("/practice")) return "practice.title";
  return "nav.today";
}

function isNestedRoute(pathname: string) { return pathname.startsWith("/sets/") || pathname === "/sets/new" || pathname.startsWith("/dictionary") || pathname === "/practice" || /^\/questions\/.+/.test(pathname); }
function parentRoute(pathname: string) { if (pathname.startsWith("/sets") || pathname.startsWith("/dictionary")) return "/library"; if (pathname.startsWith("/questions/")) return "/questions"; return "/"; }
