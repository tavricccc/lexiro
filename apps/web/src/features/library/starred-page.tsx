import { useState } from "react";
import { Play, Star } from "@phosphor-icons/react";
import type { Word } from "@lexiro/contract";
import { AppLink, Button, EmptyState, ListGroup, LoadingList, Panel, Segmented, cn } from "design-kit";
import { useStarredWords as useStarredWordsIn } from "@/data/queries";
import { Page } from "@/ui/page";
import { StarButton } from "@/ui/star-button";
import { orderedSets } from "./library-page";
import { meaningLine } from "./set-page";

const ALL = "all";

/** Every set's starred words, A to Z, grouped by set in library order: one request. */
export const useStarredWords = () => useStarredWordsIn(orderedSets);

/** Starred words of every set, grouped by set: the words to come back to. */
export default function StarredPage() {
  const { groups, loading } = useStarredWords();
  const [filter, setFilter] = useState(ALL);
  const shown = filter === ALL ? groups : groups.filter((group) => group.set.id === filter);
  const total = shown.reduce((sum, group) => sum + group.words.length, 0);
  const all = groups.reduce((sum, group) => sum + group.words.length, 0);
  const practice = `/app/practice?${shown.map((group) => `set=${group.set.id}`).join("&")}&focus=starred`;
  return (
    <Page
      back={{ href: "/app/library", label: "回到我的單字" }}
      description={all ? `${all} 個字，來自 ${groups.length} 個單字集` : undefined}
      title="標星單字"
    >
      {loading && !groups.length ? <LoadingList label="讀取標星單字" rows={4} /> : !groups.length ? (
        <EmptyState description="練習或瀏覽單字集時按星號，想再看一次的字都會收在這裡。" title="還沒有標星的單字" />
      ) : (
        <div className="grid gap-4">
          {groups.length > 1 ? (
            <Segmented
              label="單字集"
              onChange={setFilter}
              options={[{ value: ALL, label: `全部 ${all}` }, ...groups.map((group) => ({ value: group.set.id, label: `${group.set.name} ${group.words.length}` }))]}
              value={groups.some((group) => group.set.id === filter) ? filter : ALL}
            />
          ) : null}
          {shown.map((group) => (
            <ListGroup key={group.set.id} title={`${group.set.name} · ${group.words.length}`}>
              {group.words.map((word) => <StarredRow key={word.id} setId={group.set.id} word={word} />)}
            </ListGroup>
          ))}
          <Button asChild className="sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 w-full shadow-[var(--elevation-glass)] md:bottom-[calc(var(--safe-bottom)+1.5rem)] md:w-auto md:justify-self-end" size="lg" variant="primary">
            <AppLink href={practice}><Play weight="fill" />練習這 <span className="font-latin">{total}</span> 個字</AppLink>
          </Button>
        </div>
      )}
    </Page>
  );
}

function StarredRow({ setId, word }: { setId: string; word: Word }) {
  return (
    <li className="flex items-center">
      <AppLink className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 outline-none transition-colors duration-[var(--motion-control)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised" href={`/app/sets/${setId}/words/${word.id}`}>
        <span className="shrink-0 font-latin text-[1.0625rem] font-semibold" lang="en">{word.word}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[0.875rem] text-ink-muted">{meaningLine(word)}</span>
      </AppLink>
      <span className="pr-2"><StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} /></span>
    </li>
  );
}

/** The entry to the starred words, for the library and Today; hidden until a word is starred. */
export function StarredLink({ className }: { className?: string }) {
  const { count } = useStarredWords();
  if (!count) return null;
  return (
    <Panel asChild interactive>
      <AppLink className={cn("flex items-center gap-3.5", className)} href="/app/starred">
      <span className="grid size-10 shrink-0 place-items-center rounded-[0.8rem] bg-highlight/15 text-highlight"><Star className="size-5" weight="fill" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">標星單字</span>
        <span className="block text-[0.8125rem] text-ink-muted"><span className="font-latin">{count}</span> 個字</span>
      </span>
    </AppLink>
    </Panel>
  );
}
