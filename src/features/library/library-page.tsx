import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { FolderSimplePlus, MagnifyingGlass, Plus, SlidersHorizontal } from "@phosphor-icons/react";
import { compareWords, type Folder, type SetSummary } from "@lexiro/contract";
import { AppLink, Button, EmptyState, Input, Menu, Panel, Segmented } from "design-kit";
import { useLibrary } from "@/data/queries";
import { Loaded, Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";
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
  return (
    <Page
      actions={
        <>
          <Menu
            items={[
              { key: "folder", icon: FolderSimplePlus, label: "管理資料夾", onSelect: () => setFolders(true) },
            ]}
            title="單字集選項"
            trigger={<Button aria-label="更多" size="icon"><SlidersHorizontal weight="bold" /></Button>}
          />
          <Button asChild variant="primary">
            <AppLink href={folder !== ALL && folder !== LOOSE ? `/app/sets/new?folder=${folder}` : "/app/sets/new"}><Plus weight="bold" />新增單字集</AppLink>
          </Button>
        </>
      }
      title="我的單字"
    >
      <Loaded query={library}>
        {({ folders: all, sets }) => (
          <LibraryBody
            folder={folder}
            folders={all}
            onFolder={(next) => setParams(next === ALL ? {} : { folder: next }, { replace: true })}
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

function LibraryBody({ folder, folders, sets, query, onFolder, onQuery }: {
  folder: string;
  folders: Folder[];
  sets: SetSummary[];
  query: string;
  onFolder: (folder: string) => void;
  onQuery: (query: string) => void;
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
  const options = [
    { value: ALL, label: "全部" },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
    ...(sets.some((set) => !set.folderId) && folders.length ? [{ value: LOOSE, label: "未分類" }] : []),
  ];
  return (
    <div className="grid gap-4">
      <div className="relative">
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
        <Input aria-label="搜尋單字集" className="pl-11" onChange={(event) => onQuery(event.target.value)} placeholder="搜尋單字集" type="search" value={query} />
      </div>
      {folders.length ? <Segmented label="資料夾" onChange={onFolder} options={options} value={options.some((o) => o.value === folder) ? folder : ALL} /> : null}
      {visible.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((set) => (
            <li key={set.id}>
              <Panel asChild interactive>
                <AppLink className="flex items-center gap-3.5" href={`/app/sets/${set.id}`}>
                  <SetIcon hue={set.hue} icon={set.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{set.name}</span>
                    <span className="block text-[0.8125rem] text-ink-muted">
                      <span className="font-latin">{set.wordCount}</span> 個單字
                      {set.questionCount ? <> · <span className="font-latin">{set.questionCount}</span> 題</> : null}
                    </span>
                  </span>
                </AppLink>
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-6 text-center text-[0.9375rem] text-ink-muted">{query ? `沒有符合「${query}」的單字集` : "這個資料夾還是空的"}</p>
      )}
    </div>
  );
}
