import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  Cards,
  Check,
  CheckSquare,
  Copy,
  DotsThree,
  FolderSimple,
  GearSix,
  MagnifyingGlass,
  Play,
  Plus,
  ShareNetwork,
  Star,
  Trash,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type Question, type SetContent, type Word } from "@lexiro/contract";
import { AppLink, Button, Chip, ConfirmDialog, EmptyState, HeaderButton, Input, ListGroup, ListRow, Menu, Segmented, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteWords } from "@/data/library";
import { useLibrary, usePrefs, useSet } from "@/data/queries";
import { KIND_LABELS } from "@/domain/labels";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";
import { StarButton } from "@/ui/star-button";
import { CopySheet } from "./copy-sheet";
import { MoveSheet, type MoveTarget } from "./folder-dialogs";
import { folderTree } from "./folders";
import { ShareSheet } from "./share-sheet";
import { WordSheet } from "./word-page";

type Tab = "words" | "questions";

export default function SetPage() {
  const { setId = "", wordId } = useParams();
  const content = useSet(setId);
  const library = useLibrary();
  const online = useOnline();
  const [share, setShare] = useState(false);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const name = content.data?.set.name ?? "單字集";
  const tree = useMemo(() => folderTree(library.data?.folders ?? []), [library.data?.folders]);
  const folder = content.data?.set.folderId ? tree.get(content.data.set.folderId) : undefined;
  const back = folder
    ? { href: `/app/library/folder/${folder.id}`, label: `回到 ${folder.name}` }
    : { href: "/app/library", label: "回到我的單字" };

  return (
    <Page
      actions={content.data ? (
        <>
          <Menu
            items={[
              ...(content.data.words.length > 0
                ? [{ key: "cards", icon: Cards, label: "單字卡", href: `/app/sets/${setId}/cards` }]
                : []),
              {
                key: "move",
                icon: FolderSimple,
                label: "移動…",
                disabled: !online,
                onSelect: () => setMoving({ type: "set", set: content.data.set }),
              },
              { key: "share", icon: ShareNetwork, label: "分享單字集", onSelect: () => setShare(true) },
              { key: "settings", icon: GearSix, label: "單字集設定", href: `/app/sets/${setId}/settings` },
            ]}
            title={name}
            trigger={<HeaderButton aria-label="更多動作"><DotsThree weight="bold" /></HeaderButton>}
          />
          <HeaderButton aria-label="新增單字" asChild>
            <AppLink href={`/app/sets/${setId}/add`}><Plus weight="bold" /></AppLink>
          </HeaderButton>
        </>
      ) : null}
      back={back}
      description={content.data ? `${content.data.words.length} 個單字 · ${content.data.questions.length} 題` : undefined}
      documentTitle={name}
      title={content.data ? (
        <span className="flex items-center gap-3">
          <SetIcon className="size-9 [&_svg]:size-5" icon={content.data.set.icon} />
          {name}
        </span>
      ) : name}
    >
      <Loaded query={content}>{(data) => <SetBody content={data} />}</Loaded>
      {content.data ? <WordSheet content={content.data} wordId={wordId} /> : null}
      {content.data ? <ShareSheet onOpenChange={setShare} open={share} set={content.data.set} /> : null}
      <MoveSheet onClose={() => setMoving(null)} target={moving} />
    </Page>
  );
}

function SetBody({ content }: { content: SetContent }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const tab: Tab = params.get("tab") === "questions" ? "questions" : "words";
  const setTab = (next: Tab) => setParams(next === "words" ? {} : { tab: next }, { replace: true });
  if (!content.words.length)
    return (
      <EmptyState
        action={<Button asChild variant="primary"><AppLink href={`/app/sets/${content.set.id}/add`}><Plus weight="bold" />新增單字</AppLink></Button>}
        description="一次加一個，或貼上一整份清單。也可以請 Agent 幫你加。"
        title="這個單字集還沒有單字"
      />
    );
  return (
    <div className="grid gap-4">
      <Segmented
        label="內容"
        onChange={setTab}
        options={[{ value: "words", label: `單字 ${content.words.length}` }, { value: "questions", label: `題目 ${content.questions.length}` }]}
        value={tab}
      />
      <div className="relative">
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
        <Input
          aria-label={tab === "words" ? "搜尋單字" : "搜尋題目"}
          className="pl-11"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === "words" ? "搜尋英文或中文" : "搜尋題目"}
          type="search"
          value={query}
        />
      </div>
      {tab === "words" ? (
        <WordList content={content} query={query} />
      ) : (
        <>
          <QuestionList content={content} query={query} />
          <PracticeButton setId={content.set.id} />
        </>
      )}
    </div>
  );
}

/** The set's main action, kept where a thumb reaches it. */
function PracticeButton({ setId }: { setId: string }) {
  return (
    <Button asChild className="sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 w-full shadow-[var(--elevation-glass)] md:bottom-[calc(var(--safe-bottom)+1.5rem)] md:w-auto md:justify-self-end" size="lg" variant="primary">
      <AppLink href={`/app/practice?set=${setId}`}><Play weight="fill" />練習這組</AppLink>
    </Button>
  );
}

/**
 * "n. 銀行；河岸 · v. 存錢": every meaning on one line, grouped by part of speech.
 * With `supplementary` set, only the original (false) or the added (true) senses.
 */
export function meaningLine(word: Word, supplementary?: boolean): string {
  const groups = new Map<string, string[]>();
  for (const sense of word.senses.filter(
    (entry) => supplementary === undefined || Boolean(entry.supplementary) === supplementary,
  )) {
    groups.set(sense.pos, [...(groups.get(sense.pos) ?? []), sense.meaning]);
  }
  return [...groups].map(([pos, meanings]) => `${pos} ${meanings.join("；")}`).join(" · ");
}

function WordList({ content, query }: { content: SetContent; query: string }) {
  const setId = content.set.id;
  const online = useOnline();
  const showMeanings = usePrefs().data?.showMeanings ?? true;
  const [starredFirst, setStarredFirst] = useStarredFirst();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [copying, setCopying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const words = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return content.words.filter((word) => !needle || word.word.toLocaleLowerCase().includes(needle) || word.senses.some((sense) => sense.meaning.includes(needle)));
  }, [content.words, query]);

  const starred = content.words.filter((word) => word.starred).length;
  // Starred words lift to the top in the order they already had; the rest follow in their own group.
  const lifted = starredFirst && starred > 0 && !selected;
  const top = lifted ? words.filter((word) => word.starred) : [];
  const rest = lifted ? words.filter((word) => !word.starred) : words;

  const toggle = (id: string) => setSelected((current) => {
    if (!current) return current;
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderWord = (word: Word) => (
    <WordRow
      checked={selected ? selected.has(word.id) : undefined}
      key={word.id}
      onToggle={() => toggle(word.id)}
      setId={setId}
      showMeanings={showMeanings}
      word={word}
    />
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {starred > 0 ? (
          <Button
            aria-label="標星置頂"
            aria-pressed={starredFirst}
            className={cn(starredFirst && "bg-accent-soft text-accent-ink hover:bg-accent-soft")}
            onClick={() => setStarredFirst(!starredFirst)}
            size="sm"
            variant="ghost"
          >
            <Star className={cn(starredFirst && "text-highlight")} weight={starredFirst ? "fill" : "regular"} />
            標星置頂 <span className="font-latin">{starred}</span>
          </Button>
        ) : <span />}
        <div className="flex items-center gap-1.5">
          {selected ? (
            <Button
              aria-pressed
              className="bg-accent-soft text-accent-ink hover:bg-accent-soft"
              onClick={() => setSelected(null)}
              size="sm"
              variant="ghost"
            >
              <X weight="bold" />結束選取
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <AppLink href={`/app/sets/${setId}/cards`}><Cards weight="bold" />單字卡</AppLink>
              </Button>
              <Button disabled={!online} onClick={() => setSelected(new Set())} size="sm" variant="ghost">
                <CheckSquare weight="bold" />多選
              </Button>
            </>
          )}
        </div>
      </div>

      {words.length ? (
        <div aria-label="單字" className="grid gap-4" role="region">
          {top.length ? (
            <ListGroup title={`標星 · ${top.length}`}>
              {top.map(renderWord)}
            </ListGroup>
          ) : null}
          {rest.length ? (
            <ListGroup title={top.length ? `其他 · ${rest.length}` : undefined}>
              {rest.map(renderWord)}
            </ListGroup>
          ) : null}
        </div>
      ) : (
        <p className="py-6 text-center text-[0.9375rem] text-ink-muted">沒有符合的單字</p>
      )}

      {selected ? (
        <div className="content-in glass-float sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 flex items-center gap-2 rounded-full p-1.5 pl-5 md:bottom-[calc(var(--safe-bottom)+1.5rem)]">
          <span className="flex-1 text-[0.9375rem] font-medium">已選 <span className="font-latin">{selected.size}</span> 個</span>
          <Button disabled={!selected.size || !online} onClick={() => setCopying(true)} size="sm"><Copy />複製到…</Button>
          <Button disabled={!selected.size || !online} onClick={() => setRemoving(true)} size="sm" variant="danger"><Trash />刪除</Button>
        </div>
      ) : <PracticeButton setId={setId} />}

      <CopySheet fromSetId={setId} ids={[...(selected ?? [])]} onDone={() => setSelected(null)} onOpenChange={setCopying} open={copying} />
      <ConfirmDialog
        confirmLabel="刪除"
        description="用到這些單字的題目也會一起刪除。"
        onConfirm={async () => {
          setStatus("loading");
          try {
            const { removedQuestionIds } = await deleteWords(setId, [...(selected ?? [])]);
            toast.success(removedQuestionIds.length ? `已刪除，另移除 ${removedQuestionIds.length} 題` : "已刪除");
            setSelected(null);
            setRemoving(false);
          } catch (reason) {
            toast.error(errorMessage(reason));
          } finally {
            setStatus("idle");
          }
        }}
        onOpenChange={setRemoving}
        open={removing}
        status={status}
        title={`刪除 ${selected?.size ?? 0} 個單字？`}
        tone="danger"
      />
    </div>
  );
}

const STARRED_FIRST = "lexiro:starredFirst";

/** Whether a set lists its starred words first; one choice for every set, kept on this device. */
function useStarredFirst() {
  const [on, setOn] = useState(() => localStorage.getItem(STARRED_FIRST) === "1");
  const change = (next: boolean) => {
    setOn(next);
    localStorage.setItem(STARRED_FIRST, next ? "1" : "0");
  };
  return [on, change] as const;
}

function WordRow({
  setId,
  word,
  showMeanings,
  checked,
  onToggle,
}: {
  setId: string;
  word: Word;
  showMeanings: boolean;
  /** When defined, the whole row toggles selection instead of opening the word sheet. */
  checked?: boolean;
  onToggle: () => void;
}) {
  if (checked !== undefined) {
    return (
      <li>
        <button
          aria-pressed={checked}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-[var(--motion-control)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised",
            checked && "bg-accent-soft/45 hover:bg-accent-soft/60",
          )}
          onClick={onToggle}
          type="button"
        >
          <WordText showMeanings={showMeanings} word={word} />
          <span
            aria-hidden
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-[var(--motion-control)]",
              checked ? "border-contrast bg-contrast text-on-contrast" : "border-ink-faint/50",
            )}
          >
            {checked ? <Check className="mark-in size-3.5" weight="bold" /> : null}
          </span>
        </button>
      </li>
    );
  }
  return (
    <li className="flex items-center">
      <AppLink className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 outline-none transition-colors duration-[var(--motion-control)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised" href={`/app/sets/${setId}/words/${word.id}`}>
        <WordText showMeanings={showMeanings} word={word} />
      </AppLink>
      <span className="pr-2"><StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} /></span>
    </li>
  );
}

/** A word's notes: every sense's description points, in order. */
const notes = (word: Word) => word.senses.flatMap((sense) => descriptionPoints(sense.description));

function WordText({ word, showMeanings }: { word: Word; showMeanings: boolean }) {
  const main = showMeanings ? meaningLine(word, false) : "";
  const extra = showMeanings ? meaningLine(word, true) : "";
  const points = showMeanings ? notes(word) : [];
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-latin text-[1.0625rem] font-semibold">{word.word}</span>
      {main ? <span className="block truncate text-[0.8125rem] text-ink-muted">{main}</span> : null}
      {extra ? (
        <span className="mt-0.5 flex items-baseline gap-1.5 text-[0.8125rem] text-ink-muted">
          <span className="shrink-0 font-semibold text-ink-faint">補充</span>
          <span className="min-w-0 line-clamp-2">{extra}</span>
        </span>
      ) : null}
      {points.length ? (
        // A small card under the meaning, one point per line like the word page; the row grows to fit.
        <span className="mt-1.5 grid gap-0.5 rounded-tile bg-surface-raised px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-muted">
          {points.map((note, index) => (
            <span className="flex gap-1.5" key={index}><span aria-hidden className="text-ink-faint">•</span><span className="min-w-0">{note}</span></span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function questionPreview(question: Question): string {
  if (question.kind === "custom") return `${question.label}：${question.items[0].prompt}`.slice(0, 90);
  if ("items" in question) return question.title || question.passage.replace(/__(\d+)__/g, "（$1）").slice(0, 90);
  return question.prompt;
}

function QuestionList({ content, query }: { content: SetContent; query: string }) {
  if (!content.questions.length)
    return (
      <EmptyState
        description="題目由 Agent 依你的單字產生。到「我 › Agent 連線」連接 Claude 等助理，請它幫這個單字集出題。"
        title="還沒有題目"
      />
    );
  const needle = query.trim().toLocaleLowerCase();
  const matches = content.questions.filter(
    (question) => !needle || questionPreview(question).toLocaleLowerCase().includes(needle),
  );
  if (!matches.length) return <p className="py-6 text-center text-[0.9375rem] text-ink-muted">沒有符合的題目</p>;
  const groups = new Map<string, Question[]>();
  for (const question of matches) groups.set(question.kind, [...(groups.get(question.kind) ?? []), question]);
  return (
    <div className="grid gap-5">
      {[...groups].map(([kind, questions]) => (
        <ListGroup key={kind} title={`${KIND_LABELS[kind as Question["kind"]]} · ${questions.length}`}>
          {questions.map((question) => (
            <ListRow
              detail={<span className="flex items-center gap-2"><Chip>難度 {question.difficulty}</Chip>{"items" in question ? `${question.items.length} 小題` : null}</span>}
              href={`/app/sets/${content.set.id}/questions/${question.id}`}
              key={question.id}
              label={<span className="font-latin">{questionPreview(question)}</span>}
            />
          ))}
        </ListGroup>
      ))}
    </div>
  );
}
