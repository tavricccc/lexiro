import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { familiarity } from "@/src/lib/learning-record";
import { Dial, SetGlyph } from "@/components/redesign/primitives";
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
      className={`pill ${highlighted ? "selected" : ""}`}
      onClick={onOpen}
      type="button"
    >
      <Icons.folder
        aria-hidden
        className="size-[1.0625rem] shrink-0 text-brand"
        weight="regular"
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
  returnTo,
  actions,
}: SetRowMetrics & {
  id: string;
  name: string;
  returnTo?: string;
  actions?: MenuAction[];
}) {
  const library = useLibraryStore((store) => store.state);
  const record = useLearningStore((store) => store.record);
  const entry = library.sets.find((set) => set.id === id);
  const value = familiarity(
    record,
    (library.memberships[id] ?? []).flatMap((m) => m.senseIds),
  );
  const row = (
    <Link
      className={`tile set hue-${entry?.hue ?? "mint"}`}
      href={
        returnTo ? withReturnTo(`/app/sets/${id}`, returnTo) : `/app/sets/${id}`
      }
    >
      <SetGlyph set={entry ?? {}} />
      <div className="name">{name}</div>
      <div className="meta">
        <span className="latin muted">
          {entry?.createdAt.slice(0, 10).replaceAll("-", "/")}
        </span>
        <Dial value={value} />
      </div>
    </Link>
  );
  if (!actions) return row;
  return (
    <div className="set-card-host">
      <ContextMenu actions={actions}>{row}</ContextMenu>
      <div className="set-menu">
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
