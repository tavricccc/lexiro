import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Books,
  ChartLineUp,
  Desktop,
  House,
  MagnifyingGlass,
  Moon,
  Play,
  Plus,
  Sun,
  Sword,
  UserCircle,
} from "@phosphor-icons/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandItemText,
  CommandList,
  CommandSeparator,
} from "@ui-sdk/react/command";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogShortcut,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { cn } from "design-kit";
import { useLibrary } from "@/data/queries";
import { savePrefs } from "@/data/prefs";

const NAV_COMMANDS = [
  { value: "nav:/app", label: "今天", keywords: ["today", "home", "dashboard"], icon: House },
  { value: "nav:/app/library", label: "我的單字", keywords: ["library", "sets", "words"], icon: Books },
  { value: "nav:/app/progress", label: "進度統計", keywords: ["progress", "stats", "streak"], icon: ChartLineUp },
  { value: "nav:/app/rooms", label: "即時對戰", keywords: ["rooms", "battle", "multiplayer"], icon: Sword },
  { value: "nav:/app/me", label: "個人與設定", keywords: ["me", "profile", "settings"], icon: UserCircle },
] as const;

const ACTION_COMMANDS = [
  { value: "nav:/app/practice", label: "開始練習", keywords: ["practice", "drill", "quiz"], icon: Play },
  { value: "nav:/app/sets/new", label: "新增單字集", keywords: ["new", "create", "set"], icon: Plus },
  { value: "theme:light", label: "切換為淺色紙白主題", keywords: ["theme", "light", "paper"], icon: Sun },
  { value: "theme:dark", label: "切換為深色展覽主題", keywords: ["theme", "dark", "night"], icon: Moon },
  { value: "theme:system", label: "外觀跟隨系統", keywords: ["theme", "system", "auto"], icon: Desktop },
] as const;

const itemClass =
  "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink outline-none data-highlighted:bg-contrast data-highlighted:text-on-contrast [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-muted data-highlighted:[&_svg]:text-on-contrast";

export function CommandPalette({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const library = useLibrary();
  const sets = library.data?.sets ?? [];

  const run = (value: string) => {
    setOpen(false);
    if (value.startsWith("nav:")) {
      navigate(value.slice(4));
      return;
    }
    if (value.startsWith("theme:")) {
      const theme = value.slice(6) as "light" | "dark" | "system";
      localStorage.setItem("lexiro:theme", theme);
      window.dispatchEvent(new Event("lexiro:theme"));
      void savePrefs({ theme }).catch(() => {});
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        aria-label="開啟快速指令"
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 border border-line-strong/35 bg-canvas px-3 py-2 text-left font-mono text-xs font-semibold text-ink-muted outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:border-contrast focus-visible:ring-1 focus-visible:ring-contrast",
          className,
        )}
        shortcut="mod+k"
      >
        <span className="flex items-center gap-2 truncate">
          <MagnifyingGlass aria-hidden className="size-3.5 shrink-0" weight="bold" />
          <span className="truncate">快速指令…</span>
        </span>
        <DialogShortcut className="border border-line bg-surface px-1.5 py-0.5 text-[0.6875rem] text-ink-faint" />
      </DialogTrigger>

      <DialogBackdrop className="fixed inset-0 z-50 bg-[var(--scrim)] transition-opacity duration-[var(--motion-nav)] data-starting-style:opacity-0 data-ending-style:opacity-0" />
      <DialogContent className="fixed left-1/2 top-[14vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-none border-2 border-line-strong bg-surface-solid text-ink shadow-float outline-none transition-[opacity,scale] duration-[var(--motion-control)] data-starting-style:opacity-0 data-starting-style:scale-[0.985] data-ending-style:opacity-0 data-ending-style:scale-[0.985]">
        <DialogTitle className="sr-only">快速指令面板</DialogTitle>
        <Command onAction={run}>
          <div className="flex items-center gap-3 border-b-2 border-line-strong px-4">
            <MagnifyingGlass aria-hidden className="size-4 shrink-0 text-contrast" weight="bold" />
            <CommandInput
              aria-label="搜尋指令或單字集"
              className="h-13 w-full bg-transparent text-base font-medium text-ink outline-none placeholder:text-ink-faint"
              placeholder="輸入指令、畫面或單字集名稱…"
            />
            <span className="shrink-0 font-mono text-[0.6875rem] font-semibold uppercase text-ink-faint">ESC</span>
          </div>

          <CommandEmpty className="px-4 py-10 text-center font-mono text-xs text-ink-muted">
            找不到相符的指令或單字集
          </CommandEmpty>

          <CommandList className="max-h-[min(24rem,60svh)] overflow-y-auto overscroll-contain py-2">
            <CommandGroup>
              <CommandGroupLabel className="px-4 pb-1.5 pt-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                01 // 快速動作
              </CommandGroupLabel>
              {ACTION_COMMANDS.map((item) => (
                <CommandItem className={itemClass} key={item.value} keywords={[...item.keywords]} label={item.label} value={item.value}>
                  <CommandItemIcon><item.icon weight="bold" /></CommandItemIcon>
                  <CommandItemText className="min-w-0 flex-1 truncate">
                    {(state) =>
                      state.segments.map((seg, idx) =>
                        seg.match ? <mark className="bg-transparent font-black underline decoration-2 underline-offset-2 text-inherit" key={idx}>{seg.text}</mark> : seg.text,
                      )
                    }
                  </CommandItemText>
                </CommandItem>
              ))}
            </CommandGroup>

            {sets.length ? (
              <>
                <CommandSeparator className="my-1.5 h-px bg-line" />
                <CommandGroup>
                  <CommandGroupLabel className="px-4 pb-1.5 pt-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                    02 // 單字集 ({sets.length})
                  </CommandGroupLabel>
                  {sets.slice(0, 20).map((set) => (
                    <CommandItem className={itemClass} key={set.id} keywords={["set", "單字集"]} label={set.name} value={`nav:/app/sets/${set.id}`}>
                      <CommandItemIcon><Books weight="bold" /></CommandItemIcon>
                      <CommandItemText className="min-w-0 flex-1 truncate">
                        {(state) =>
                          state.segments.map((seg, idx) =>
                            seg.match ? <mark className="bg-transparent font-black underline decoration-2 underline-offset-2 text-inherit" key={idx}>{seg.text}</mark> : seg.text,
                          )
                        }
                      </CommandItemText>
                      <span className="shrink-0 font-mono text-xs opacity-70">{set.wordCount} 字</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            <CommandSeparator className="my-1.5 h-px bg-line" />
            <CommandGroup>
              <CommandGroupLabel className="px-4 pb-1.5 pt-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                03 // 導覽
              </CommandGroupLabel>
              {NAV_COMMANDS.map((item) => (
                <CommandItem className={itemClass} key={item.value} keywords={[...item.keywords]} label={item.label} value={item.value}>
                  <CommandItemIcon><item.icon weight="bold" /></CommandItemIcon>
                  <CommandItemText className="min-w-0 flex-1 truncate">
                    {(state) =>
                      state.segments.map((seg, idx) =>
                        seg.match ? <mark className="bg-transparent font-black underline decoration-2 underline-offset-2 text-inherit" key={idx}>{seg.text}</mark> : seg.text,
                      )
                    }
                  </CommandItemText>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
