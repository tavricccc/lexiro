import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { FolderSimple, FolderSimplePlus, MagnifyingGlass, Play, Plus } from "@phosphor-icons/react";
import { compareWords, type Folder, type SetSummary } from "@lexiro/contract";
import { AppLink, Button, EmptyState, Input, Segmented, cn } from "design-kit";
import { useLibrary } from "@/data/queries";
import { Loaded, Page } from "@/ui/page";
import { HUE_BAR, SetIcon } from "@/ui/set-icon";
import { FolderSheet } from "./folder-sheet";

const ALL = "all", LOOSE = "none";

/** Sets in a folder in the order the person placed them, the rest A to Z after. */
export function orderedSets(sets: SetSummary[]): SetSummary[] {
  return [...sets].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || compareWords(a.name, b.name));
}

export default function LibraryPage() {
  const library = useLibrary();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState(false);
  const folder = params.get("folder") ?? ALL;
  const newSetHref = folder !== ALL && folder !== LOOSE ? `/app/sets/new?folder=${folder}` : "/app/sets/new";

  return (
    <Page
      actions={
        <>
          <Button onClick={() => setFolders(true)} size="sm" variant="secondary">
            <FolderSimplePlus weight="bold" />
            <span className="hidden sm:inline">資料夾</span>
          </Button>
          <Button asChild size="sm" variant="primary">
            <AppLink href={newSetHref}><Plus weight="bold" />新增單字集</AppLink>
          </Button>
        </>
      }
      kicker="02 // LEXICON CATALOG"
      title="我的單字"
    >
      <Loaded query={library}>
        {({ folders: all, sets }) => (
          <LibraryBody
            folder={folder}
            folders={all}
            onFolder={(next) => setParams(next === ALL ? {} : { folder: next }, { replace: true })}
            onManageFolders={() => setFolders(true)}
            onQuery={setQuery}
            query={query}
            sets={sets}
          />
        )}
      </Loaded>
      <FolderSheet onOpenChange={setFolders} open={folders} />
    </Page>
  );
}

function LibraryBody({ folder, folders, sets, query, onFolder, onQuery, onManageFolders }: {
  folder: string;
  folders: Folder[];
  sets: SetSummary[];
  query: string;
  onFolder: (folder: string) => void;
  onQuery: (query: string) => void;
  onManageFolders: () => void;
}) {
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const inFolder = (set: SetSummary) => folder === ALL || (folder === LOOSE ? !set.folderId : set.folderId === folder);
    return orderedSets(sets.filter((set) => inFolder(set) && (!needle || set.name.toLocaleLowerCase().includes(needle))));
  }, [sets, folder, query]);

  if (!sets.length)
    return (
      <EmptyState
        action={<Button asChild variant="primary"><AppLink href="/app/sets/new"><Plus weight="bold" />建立第一個單字集</AppLink></Button>}
        description="單字集是一組要一起練習的單字，例如一課課文或一次考試的範圍。"
        title="還沒有單字集"
      />
    );

  const looseCount = sets.filter((set) => !set.folderId).length;
  const folderOptions = [
    { value: ALL, label: "全部", count: sets.length },
    ...folders.map((f) => ({ value: f.id, label: f.name, count: sets.filter((s) => s.folderId === f.id).length })),
    ...(looseCount && folders.length ? [{ value: LOOSE, label: "未分類", count: looseCount }] : []),
  ];
  const activeFolder = folderOptions.some((o) => o.value === folder) ? folder : ALL;

  return (
    <div className={cn("grid items-start gap-6", folders.length > 0 && "lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8")}>
      {/* Desktop Folder Directory Column */}
      {folders.length ? (
        <aside className="hidden lg:grid lg:gap-3 lg:sticky lg:top-8">
          <div className="flex items-center justify-between border-b-2 border-line-strong pb-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">FOLDERS</span>
            <span className="font-mono text-xs text-ink-faint">{folders.length}</span>
          </div>
          <ul className="divide-y divide-line border border-line bg-surface">
            {folderOptions.map((option, index) => {
              const active = option.value === activeFolder;
              return (
                <li key={option.value}>
                  <button
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast",
                      active ? "bg-contrast text-on-contrast" : "text-ink hover:bg-surface-raised",
                    )}
                    onClick={() => onFolder(option.value)}
                    type="button"
                  >
                    <span className={cn("font-mono text-[0.6875rem] tabular-nums", active ? "text-on-contrast/80" : "text-ink-faint")}>
                      {String(index).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className={cn("font-mono text-xs tabular-nums", active ? "text-on-contrast/85" : "text-ink-muted")}>
                      {option.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button className="justify-start" onClick={onManageFolders} size="sm" variant="ghost">
            <FolderSimplePlus weight="bold" />管理資料夾
          </Button>
        </aside>
      ) : null}

      {/* Main Catalog Column */}
      <div className="grid min-w-0 gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" weight="bold" />
            <Input
              aria-label="搜尋單字集"
              className="pl-10"
              onChange={(event) => onQuery(event.target.value)}
              placeholder="搜尋單字集名稱…"
              type="search"
              value={query}
            />
          </div>
          <span className="border border-line bg-surface px-3 py-2.5 font-mono text-xs font-semibold tabular-nums text-ink-muted">
            {visible.length} / {sets.length} SETS
          </span>
        </div>

        {/* Mobile/Tablet Folder Bar */}
        {folders.length ? (
          <div className="lg:hidden">
            <Segmented
              label="資料夾"
              onChange={onFolder}
              options={folderOptions.map((o) => ({
                value: o.value,
                label: o.label,
                icon: o.value !== ALL && o.value !== LOOSE ? <FolderSimple weight="fill" /> : undefined,
              }))}
              value={activeFolder}
            />
          </div>
        ) : null}

        {visible.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((set, index) => (
              <li className="group flex flex-col border border-line bg-surface transition-colors hover:border-line-strong" key={set.id}>
                <div className={cn("h-1.5 w-full", HUE_BAR[set.hue] ?? "bg-contrast")} />
                <AppLink className="flex flex-1 flex-col gap-4 p-5 outline-none focus-visible:bg-surface-raised" href={`/app/sets/${set.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-bold tabular-nums text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                    <SetIcon className="size-9 [&_svg]:size-4" hue={set.hue} icon={set.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xl font-extrabold tracking-[-0.025em] text-ink group-hover:text-contrast">{set.name}</span>
                  </div>
                </AppLink>
                <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-raised/50 px-5 py-2.5">
                  <span className="font-mono text-xs font-medium text-ink-muted">
                    <span className="font-bold text-ink">{set.wordCount}</span> 字
                    {set.questionCount ? <> · <span className="font-bold text-ink">{set.questionCount}</span> 題</> : null}
                  </span>
                  {set.wordCount > 0 ? (
                    <AppLink
                      aria-label={`練習 ${set.name}`}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-[0.06em] text-contrast hover:underline"
                      href={`/app/practice?set=${set.id}`}
                    >
                      <Play className="size-3" weight="fill" />
                      練習
                    </AppLink>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-line bg-surface px-6 py-12 text-center font-mono text-sm text-ink-muted">
            {query ? `沒有符合「${query}」的單字集` : "這個資料夾還是空的"}
          </div>
        )}
      </div>
    </div>
  );
}
