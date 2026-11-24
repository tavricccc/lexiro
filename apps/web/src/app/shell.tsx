import { useEffect } from "react";
import { useNavigation as useRouterNavigation } from "react-router";
import { Books, ChartLineUp, House, Sword, UserCircle } from "@phosphor-icons/react";
import { PrimaryNav, type NavItem } from "design-kit";
import { useAnswerFlush } from "@/data/learning";
import { useRevisionWatch } from "@/data/queries";
import { useThemeSync } from "@/data/prefs";
import { Brand } from "@/ui/brand";
import { preloadScreens } from "./routes";
import { Stage } from "./stage";

const NAV: NavItem[] = [
  { href: "/app", icon: House, label: "今天" },
  { href: "/app/library", icon: Books, label: "單字" },
  { href: "/app/progress", icon: ChartLineUp, label: "進度" },
  { href: "/app/rooms", icon: Sword, label: "對戰" },
  { href: "/app/me", icon: UserCircle, label: "我" },
];

const rail = (tab: string | null) => (
  <aside className="stage-rail flex-col gap-8 px-5 pb-6 pt-8">
    <Brand className="px-3.5" />
    <PrimaryNav activeHref={tab} items={NAV} label="主要導覽" variant="rail" />
  </aside>
);

const dock = (tab: string) => (
  <div className="screen-dock">
    <PrimaryNav activeHref={tab} className="w-full max-w-md" items={NAV} label="主要導覽" variant="dock" />
  </div>
);

export function WorkspaceShell() {
  useRevisionWatch(true);
  useAnswerFlush(true);
  useThemeSync();
  // A screen whose code is here already answers its tap at once.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 400));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(preloadScreens);
    return () => cancel(handle);
  }, []);
  const loading = useRouterNavigation().state === "loading";
  return (
    <main className="content-in">
      <div aria-hidden className="route-progress" data-active={loading || undefined} />
      <Stage dock={dock} rail={rail} />
    </main>
  );
}
