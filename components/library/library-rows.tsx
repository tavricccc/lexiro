import Link from "@/components/ui/app-link";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ContextMenu, Menu, type MenuAction } from "@/components/ui/menu";
import { t } from "@/lib/i18n";
import { withReturnTo } from "@/lib/browse-routes";

interface SetRowMetrics {
  questionCount: number;
  senseCount: number;
}

/** A folder as an oval, as in the app: its name and how much is in it. */
export function FolderRow({
  folderId,
  highlighted = false,
  itemCount,
  name,
  onOpen,
}: {
  /** Lets a set dragged in reorder mode find the folder under the pointer. */
  folderId?: string;
  /** A dragged set is over this folder and would move into it. */
  highlighted?: boolean;
  itemCount: number;
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      aria-label={t("library.openFolder", { name })}
      data-folder-id={folderId}
      className={`t-row flex min-h-11 max-w-full items-center gap-2 rounded-full ${highlighted ? "bg-[var(--brand-50)] ring-2 ring-brand" : "bg-card"} [--row-bleed:0px] [--row-radius:9999px] pl-4 pr-[1.125rem] text-left transition-colors hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`}
      onClick={onOpen}
      type="button"
    >
      <Icons.folder
        aria-hidden
        className="size-[1.0625rem] shrink-0 text-brand"
        weight="fill"
      />
      <span className="min-w-0 truncate text-base font-semibold">{name}</span>
      <span className="font-latin text-base font-bold tabular-nums text-muted-foreground">
        {itemCount}
      </span>
    </button>
  );
}

/**
 * A set, led by its name, with its size set large on the right. Its actions
 * open on a right click or a long press, as in the app, and from a ⋯ button
 * that shows on hover.
 */
export function SetRow({
  id,
  name,
  questionCount,
  senseCount,
  returnTo,
  actions,
}: SetRowMetrics & {
  id: string;
  name: string;
  returnTo?: string;
  actions?: MenuAction[];
}) {
  const latin = /^[\x20-\x7e]+$/.test(name);
  const row = (
    <Link
      className="t-row [-webkit-touch-callout:none] flex min-h-[5.25rem] items-center gap-4 rounded-[var(--radius-card)] bg-card [--row-bleed:0px] [--row-radius:var(--radius-card)] py-4 pl-5 pr-[1.125rem] shadow-[0_6px_18px_rgb(0_0_0/4%)] transition-colors hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      href={
        returnTo ? withReturnTo(`/app/sets/${id}`, returnTo) : `/app/sets/${id}`
      }
    >
      <span className="grid min-w-0 flex-1 gap-1">
        <span
          className={
            latin
              ? "line-clamp-2 font-latin text-[1.375rem] font-extrabold leading-[1.2] tracking-[-0.02em]"
              : "line-clamp-2 text-xl font-extrabold leading-[1.3]"
          }
        >
          {name}
        </span>
        <span className="type-hint text-muted-foreground">
          {questionCount
            ? t("library.questionCount", { count: questionCount })
            : t("library.noQuestions")}
        </span>
      </span>
      <span className="grid justify-items-end">
        <span className="font-latin text-[2.125rem] font-extrabold leading-9 tracking-[-0.03em] text-brand tabular-nums">
          {senseCount}
        </span>
        <span className="type-hint text-muted-foreground">
          {t("library.senseUnit")}
        </span>
      </span>
    </Link>
  );
  if (!actions) return row;
  return (
    <div className="group relative">
      <ContextMenu actions={actions}>{row}</ContextMenu>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
        <Menu
          actions={actions}
          label={t("library.setActions", { name })}
          trigger={
            <Button
              aria-label={t("library.setActions", { name })}
              className="size-8"
              size="icon"
              type="button"
              variant="ghost"
            >
              <Icons.more />
            </Button>
          }
        />
      </div>
    </div>
  );
}
