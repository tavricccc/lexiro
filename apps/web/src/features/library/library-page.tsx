import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Cards,
  CaretRight,
  DotsThree,
  FolderSimple,
  FolderSimplePlus,
  GearSix,
  Hash,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  ShareNetwork,
  Trash,
} from "@phosphor-icons/react";
import type { Folder, LibraryIndex, SetSummary } from "@lexiro/contract";
import { AppLink, Button, EmptyState, HeaderButton, Input, Menu, cn, type MenuItem } from "design-kit";
import { useLibrary } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";
import {
  DeleteFolderDialog,
  DeleteSetDialog,
  FolderNameDialog,
  MoveSheet,
  type MoveTarget,
} from "./folder-dialogs";
import { LIBRARY_ROOT, folderTree, orderedSets, type FolderTree } from "./folders";
import { JoinSheet } from "./join-sheet";
import { ShareSheet } from "./share-sheet";
import { StarredLink } from "./starred-page";

export { orderedSets };

/** One level of the library: the folders and sets directly inside `folderId` (null is the top). */
export default function LibraryPage() {
  const { folderId: rawFolderId } = useParams();
  const folderId = rawFolderId ?? null;
  const navigate = useNavigate();
  const library = useLibrary();
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [join, setJoin] = useState(false);
  const [nameDialog, setNameDialog] = useState<
    { type: "create"; parentId: string | null; order: number; parentName?: string } | { type: "rename"; folder: Folder } | null
  >(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const [removingFolder, setRemovingFolder] = useState<Folder | null>(null);
  const [removingSet, setRemovingSet] = useState<SetSummary | null>(null);
  const [sharing, setSharing] = useState<SetSummary | null>(null);

  const tree = useMemo(() => folderTree(library.data?.folders ?? []), [library.data?.folders]);
  const folder = tree.get(folderId);
  const missing = folderId !== null && Boolean(library.data) && !folder;
  const parent = folder?.parentId ? tree.get(folder.parentId) : undefined;
  const back = folderId
    ? parent
      ? { href: `/app/library/folder/${parent.id}`, label: `回到 ${parent.name}` }
      : { href: "/app/library", label: `回到${LIBRARY_ROOT}` }
    : undefined;
  const inFolder = folderId ? `?folder=${encodeURIComponent(folderId)}` : "";

  const trail = folder ? tree.trail(folder.id) : [];
  const parentPath = trail.length > 1 ? trail.slice(0, -1).map((entry) => entry.name).join(" / ") : undefined;

  return (
    <Page
      actions={
        <>
          {folder ? (
            <Menu
              items={[
                { key: "rename", icon: PencilSimple, label: "重新命名", disabled: !online, onSelect: () => setNameDialog({ type: "rename", folder }) },
                { key: "move", icon: FolderSimple, label: "移動…", disabled: !online, onSelect: () => setMoving({ type: "folder", folder }) },
                { key: "delete", icon: Trash, label: "刪除資料夾", tone: "danger", disabled: !online, onSelect: () => setRemovingFolder(folder) },
              ]}
              title={folder.name}
              trigger={<HeaderButton aria-label="資料夾動作"><DotsThree weight="bold" /></HeaderButton>}
            />
          ) : null}
          {!missing ? (
            <Menu
              items={[
                { key: "set", icon: Plus, label: "新增單字集", href: `/app/sets/new${inFolder}` },
                { key: "join", icon: Hash, label: "用代碼加入", disabled: !online, onSelect: () => setJoin(true) },
                {
                  key: "folder",
                  icon: FolderSimplePlus,
                  label: "新增資料夾",
                  disabled: !online,
                  onSelect: () => setNameDialog({
                    type: "create",
                    parentId: folderId,
                    order: tree.children(folderId).length,
                    parentName: folder ? tree.path(folder.id) : undefined,
                  }),
                },
              ]}
              title="新增"
              trigger={<HeaderButton aria-label="新增" prominent><Plus weight="bold" /></HeaderButton>}
            />
          ) : null}
        </>
      }
      back={back}
      description={parentPath}
      title={folderId === null ? LIBRARY_ROOT : (folder?.name ?? "資料夾")}
    >
      <Loaded query={library}>
        {(data) =>
          missing ? (
            <EmptyState
              action={<Button asChild><AppLink href="/app/library">回到{LIBRARY_ROOT}</AppLink></Button>}
              title="找不到這個資料夾"
            />
          ) : (
            <Level
              data={data}
              folderId={folderId}
              onDeleteFolder={setRemovingFolder}
              onDeleteSet={setRemovingSet}
              onJoin={() => setJoin(true)}
              onMove={setMoving}
              onQuery={setQuery}
              onRenameFolder={(target) => setNameDialog({ type: "rename", folder: target })}
              onShareSet={setSharing}
              online={online}
              query={query}
              tree={tree}
            />
          )
        }
      </Loaded>

      <JoinSheet folder={inFolder} onOpenChange={setJoin} open={join} />
      <FolderNameDialog mode={nameDialog} onClose={() => setNameDialog(null)} />
      <MoveSheet onClose={() => setMoving(null)} target={moving} />
      <DeleteFolderDialog
        folder={removingFolder}
        onClose={() => setRemovingFolder(null)}
        onDeleted={() => {
          if (removingFolder && removingFolder.id === folderId) {
            navigate(parent ? `/app/library/folder/${parent.id}` : "/app/library", { replace: true });
          }
        }}
      />
      <DeleteSetDialog onClose={() => setRemovingSet(null)} set={removingSet} />
      {sharing ? (
        <ShareSheet onOpenChange={(open) => { if (!open) setSharing(null); }} open set={sharing} />
      ) : null}
    </Page>
  );
}

function Level({
  data,
  tree,
  folderId,
  query,
  online,
  onQuery,
  onJoin,
  onRenameFolder,
  onMove,
  onDeleteFolder,
  onDeleteSet,
  onShareSet,
}: {
  data: LibraryIndex;
  tree: FolderTree;
  folderId: string | null;
  query: string;
  online: boolean;
  onQuery: (query: string) => void;
  onJoin: () => void;
  onRenameFolder: (folder: Folder) => void;
  onMove: (target: MoveTarget) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDeleteSet: (set: SetSummary) => void;
  onShareSet: (set: SetSummary) => void;
}) {
  const root = folderId === null;
  const needle = query.trim().toLocaleLowerCase();
  // Searching looks through everything below this level.
  const scope = folderId === null ? null : tree.within(folderId);
  const homeOf = (set: SetSummary) => (tree.get(set.folderId) ? set.folderId : null);

  const folders = useMemo(() => {
    if (!needle) return tree.children(folderId);
    return tree.flat
      .map((entry) => entry.folder)
      .filter(
        (entry) =>
          entry.id !== folderId &&
          (!scope || scope.has(entry.id)) &&
          entry.name.toLocaleLowerCase().includes(needle),
      );
  }, [tree, folderId, needle, scope]);

  const sets = useMemo(
    () =>
      orderedSets(
        data.sets.filter((set) => {
          const home = homeOf(set);
          if (!needle) return home === folderId;
          return (
            (!scope || (home !== null && scope.has(home))) &&
            set.name.toLocaleLowerCase().includes(needle)
          );
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.sets, tree, folderId, needle, scope],
  );

  const place = (id: string | null) => (needle && id ? tree.path(id) : undefined);

  if (root && !data.sets.length && !data.folders.length) {
    return (
      <EmptyState
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary"><AppLink href="/app/sets/new"><Plus weight="bold" />建立第一個單字集</AppLink></Button>
            <Button disabled={!online} onClick={onJoin}><Hash weight="bold" />用代碼加入</Button>
          </div>
        }
        description="單字集是一組要一起練習的單字，例如一課課文或一次考試的範圍。"
        title="還沒有單字集"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative">
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
        <Input
          aria-label={root ? "搜尋單字集和資料夾" : "在這個資料夾搜尋"}
          className="pl-11"
          onChange={(event) => onQuery(event.target.value)}
          placeholder={root ? "搜尋單字集和資料夾" : "在這個資料夾搜尋"}
          type="search"
          value={query}
        />
      </div>
      {root && !needle ? <StarredLink /> : null}
      {folders.length + sets.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {folders.map((entry) => {
            const inside = tree.within(entry.id);
            const count = data.sets.filter((set) => set.folderId !== null && inside.has(set.folderId)).length;
            return (
              <FolderCard
                count={count}
                folder={entry}
                key={entry.id}
                onDelete={() => onDeleteFolder(entry)}
                onMove={() => onMove({ type: "folder", folder: entry })}
                onRename={() => onRenameFolder(entry)}
                online={online}
                place={place(entry.parentId)}
              />
            );
          })}
          {sets.map((set) => (
            <SetCard
              key={set.id}
              onDelete={() => onDeleteSet(set)}
              onMove={() => onMove({ type: "set", set })}
              onShare={() => onShareSet(set)}
              online={online}
              place={place(homeOf(set))}
              set={set}
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-8 text-center text-[0.9375rem] text-ink-muted">
          {needle ? `沒有符合「${query.trim()}」的結果` : root ? "" : "這個資料夾是空的"}
        </p>
      )}
    </div>
  );
}

const cardClass =
  "group flex items-center rounded-panel bg-surface shadow-panel transition-[background-color,box-shadow,scale] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-solid";

function FolderCard({
  folder,
  count,
  place,
  online,
  onRename,
  onMove,
  onDelete,
}: {
  folder: Folder;
  count: number;
  place?: string;
  online: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const items: MenuItem[] = [
    { key: "rename", icon: PencilSimple, label: "重新命名", disabled: !online, onSelect: onRename },
    { key: "move", icon: FolderSimple, label: "移動…", disabled: !online, onSelect: onMove },
    { key: "delete", icon: Trash, label: "刪除資料夾", tone: "danger", disabled: !online, onSelect: onDelete },
  ];
  return (
    <li className={cardClass}>
      <AppLink
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-l-panel py-4 pl-4 pr-2 outline-none transition-[scale] duration-[var(--motion-control)] active:scale-[var(--motion-card-press-scale)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        href={`/app/library/folder/${folder.id}`}
      >
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-tile bg-surface-raised text-ink [&_svg]:size-6">
          <FolderSimple weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{folder.name}</span>
          <span className="block truncate text-[0.8125rem] text-ink-muted">
            <span className="font-latin">{count}</span> 個單字集
            {place ? ` · ${place}` : ""}
          </span>
        </span>
        <CaretRight aria-hidden className="size-4 shrink-0 text-ink-faint" weight="bold" />
      </AppLink>
      {online ? (
        <span className="pr-2">
          <Menu
            items={items}
            title={folder.name}
            trigger={
              <Button
                aria-label={`${folder.name} 更多動作`}
                className={cn("text-ink-faint hover:text-ink")}
                size="icon-sm"
                variant="ghost"
              >
                <DotsThree weight="bold" />
              </Button>
            }
          />
        </span>
      ) : null}
    </li>
  );
}

function SetCard({
  set,
  place,
  online,
  onShare,
  onMove,
  onDelete,
}: {
  set: SetSummary;
  place?: string;
  online: boolean;
  onShare: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const items: MenuItem[] = [
    ...(set.wordCount > 0
      ? [
          { key: "practice", icon: Play, label: "開始練習", href: `/app/practice?set=${set.id}` },
          { key: "cards", icon: Cards, label: "單字卡", href: `/app/sets/${set.id}/cards` },
        ]
      : []),
    { key: "share", icon: ShareNetwork, label: "分享單字集", onSelect: onShare },
    { key: "settings", icon: GearSix, label: "單字集設定", href: `/app/sets/${set.id}/settings` },
    { key: "move", icon: FolderSimple, label: "移動…", disabled: !online, onSelect: onMove },
    { key: "delete", icon: Trash, label: "刪除單字集", tone: "danger", disabled: !online, onSelect: onDelete },
  ];
  return (
    <li className={cardClass}>
      <AppLink
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-l-panel py-4 pl-4 pr-2 outline-none transition-[scale] duration-[var(--motion-control)] active:scale-[var(--motion-card-press-scale)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        href={`/app/sets/${set.id}`}
      >
        <SetIcon icon={set.icon} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{set.name}</span>
          <span className="block truncate text-[0.8125rem] text-ink-muted">
            <span className="font-latin">{set.wordCount}</span> 個單字
            {set.questionCount ? <> · <span className="font-latin">{set.questionCount}</span> 題</> : null}
            {place ? ` · ${place}` : ""}
          </span>
        </span>
      </AppLink>
      <span className="pr-2">
        <Menu
          items={items}
          title={set.name}
          trigger={
            <Button
              aria-label={`${set.name} 更多動作`}
              className="text-ink-faint hover:text-ink"
              size="icon-sm"
              variant="ghost"
            >
              <DotsThree weight="bold" />
            </Button>
          }
        />
      </span>
    </li>
  );
}
