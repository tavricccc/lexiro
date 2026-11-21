import { useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "react-router";
import { CheckSquare, Copy, DotsThree, GearSix, MagnifyingGlass, Play, Plus, ShareNetwork, Star, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type Question, type SetContent, type Word } from "@lexiro/contract";
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/react/resizable";
import { AppLink, Button, Chip, ConfirmDialog, EmptyState, HeaderButton, Input, ListGroup, ListRow, Menu, Segmented, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteWords } from "@/data/library";
import { useSet } from "@/data/queries";
import { KIND_LABELS } from "@/domain/labels";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";
import { StarButton } from "@/ui/star-button";
import { CopySheet } from "./copy-sheet";
import { ShareSheet } from "./share-sheet";
import { WordInspector, WordSheet } from "./word-page";

type Tab = "words" | "questions";

const WIDE_QUERY = "(min-width: 1024px)";
function useWideDesktop() {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(WIDE_QUERY);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_QUERY).matches : false),
    () => false,
  );
}

export default function SetPage() {
  const { setId = "", wordId } = useParams();
  const content = useSet(setId);
  const [share, setShare] = useState(false);
  const wide = useWideDesktop();
  const name = content.data?.set.name ?? "單字集";
  return (
    <Page
      actions={content.data ? (
        <>
          <Menu
            items={[
              { key: "settings", icon: GearSix, label: "單字集設定", href: `/app/sets/${setId}/settings` },
              { key: "share", icon: ShareNetwork, label: "分享", onSelect: () => setShare(true) },
            ]}
            title={name}
            trigger={<HeaderButton aria-label="更多動作"><DotsThree weight="bold" /></HeaderButton>}
          />
          <Button asChild size="sm" variant="secondary">
            <AppLink href={`/app/sets/${setId}/add`}><Plus weight="bold" /><span className="hidden sm:inline">新增單字</span></AppLink>
          </Button>
          {content.data.words.length ? (
            <Button asChild size="sm" variant="primary">
              <AppLink href={`/app/practice?set=${setId}`}><Play weight="fill" />練習</AppLink>
            </Button>
          ) : null}
        </>
      ) : null}
      back={{ href: "/app/library", label: "我的單字" }}
      documentTitle={name}
      kicker={content.data ? `SET // ${content.data.words.length} WORDS · ${content.data.questions.length} QUESTIONS` : "SET"}
      title={content.data ? (
        <span className="inline-flex items-center gap-3.5"><SetIcon className="size-10 [&_svg]:size-5" hue={content.data.set.hue} icon={content.data.set.icon} /><span>{name}</span></span>
      ) : name}
    >
      <Loaded query={content}>{(data) => <SetBody content={data} wide={wide} wordId={wordId} />}</Loaded>
      {content.data && !wide ? <WordSheet content={content.data} wordId={wordId} /> : null}
      {content.data ? <ShareSheet onOpenChange={setShare} open={share} set={content.data.set} /> : null}
    </Page>
  );
}

function SetBody({ content, wide, wordId }: { content: SetContent; wide: boolean; wordId: string | undefined }) {
  const [params, setParams] = useSearchParams();
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="內容"
          onChange={setTab}
          options={[{ value: "words", label: `單字 ${content.words.length}` }, { value: "questions", label: `題目 ${content.questions.length}` }]}
          value={tab}
        />
      </div>
      {tab === "words" ? (
        wide ? (
          <Resizable autoSaveId="lexiro:set-split" className="flex items-start">
            <ResizablePanel className="min-w-0 pr-5" defaultSize={58} id="words" minSize={36}>
              <WordList activeWordId={wordId} content={content} />
            </ResizablePanel>
            <ResizableHandle
              aria-label="調整單字列表與詞條檢視寬度"
              className="group sticky top-8 flex h-40 w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-line outline-none transition-colors hover:bg-contrast data-dragging:bg-contrast focus-visible:bg-contrast"
            >
              <span aria-hidden className="h-8 w-0.5 bg-surface" />
            </ResizableHandle>
            <ResizablePanel className="min-w-0 pl-5" defaultSize={42} id="inspector" minSize={28}>
              <WordInspector content={content} wordId={wordId} />
            </ResizablePanel>
          </Resizable>
        ) : (
          <WordList activeWordId={wordId} content={content} />
        )
      ) : <QuestionList content={content} />}
    </div>
  );
}

/** "n. 銀行；河岸 · v. 存錢": every meaning on one line, grouped by part of speech. */
export function meaningLine(word: Word): string {
  const groups = new Map<string, string[]>();
  for (const sense of word.senses) groups.set(sense.pos, [...(groups.get(sense.pos) ?? []), sense.meaning]);
  return [...groups].map(([pos, meanings]) => `${pos} ${meanings.join("；")}`).join(" · ");
}

function WordList({ content, activeWordId }: { content: SetContent; activeWordId: string | undefined }) {
  const setId = content.set.id;
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [copying, setCopying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const words = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return content.words.filter((word) => (!starredOnly || word.starred)
      && (!needle || word.word.toLocaleLowerCase().includes(needle) || word.senses.some((sense) => sense.meaning.includes(needle))));
  }, [content.words, query, starredOnly]);
  const starred = content.words.filter((word) => word.starred).length;
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" weight="bold" />
          <Input aria-label="搜尋單字" className="pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="搜尋英文或中文…" type="search" value={query} />
        </div>
        {starred ? (
          <Button
            aria-pressed={starredOnly}
            className={cn(starredOnly && "border-highlight bg-highlight text-white hover:bg-highlight/90")}
            onClick={() => setStarredOnly(!starredOnly)}
            size="md"
          >
            <Star weight={starredOnly ? "fill" : "regular"} />
            <span className="font-mono">{starred}</span>
          </Button>
        ) : null}
        <Button aria-label={selected ? "結束選取" : "選取單字"} aria-pressed={selected !== null} disabled={!online} onClick={() => setSelected(selected ? null : new Set())} size="icon">
          {selected ? <X weight="bold" /> : <CheckSquare weight="bold" />}
        </Button>
      </div>

      {words.length ? (
        <ul aria-label="單字" className="divide-y divide-line border border-line border-t-2 border-t-line-strong bg-surface">
          {words.map((word, index) => {
            const isCurrent = word.id === activeWordId;
            return selected ? (
              <li key={word.id}>
                <label className="flex min-h-14 cursor-pointer items-start gap-3.5 px-4 py-3 hover:bg-surface-raised">
                  <input checked={selected.has(word.id)} className="mt-1 size-4 accent-[var(--contrast)]" onChange={() => toggle(word.id)} type="checkbox" />
                  <WordText index={index} word={word} />
                </label>
              </li>
            ) : (
              <li className={cn("flex items-center transition-colors", isCurrent && "border-l-4 border-l-contrast bg-accent-soft")} key={word.id}>
                <AppLink
                  className="flex min-h-14 min-w-0 flex-1 items-start gap-3.5 py-3 pl-4 pr-2 outline-none transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised"
                  href={`/app/sets/${setId}/words/${word.id}`}
                >
                  <WordText index={index} word={word} />
                </AppLink>
                <span className="pr-2"><StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} /></span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border border-line bg-surface py-10 text-center font-mono text-sm text-ink-muted">沒有符合的單字</p>
      )}

      {selected ? (
        <div className="bar-in sticky bottom-[calc(var(--bottom-nav-gap)+0.75rem)] z-30 flex items-center gap-2 border-2 border-line-strong bg-surface p-2.5 pl-4 shadow-float md:bottom-6">
          <span className="flex-1 font-mono text-xs font-bold uppercase tracking-[0.06em]">已選 {selected.size} 個</span>
          <Button disabled={!selected.size} onClick={() => setCopying(true)} size="sm"><Copy weight="bold" />複製到…</Button>
          <Button disabled={!selected.size} onClick={() => setRemoving(true)} size="sm" variant="danger"><Trash weight="bold" />刪除</Button>
        </div>
      ) : null}

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

const notes = (word: Word) => word.senses.flatMap((sense) => descriptionPoints(sense.description));

function WordText({ word, index }: { word: Word; index: number }) {
  const points = notes(word);
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-3">
      <span className="w-6 shrink-0 font-mono text-[0.75rem] font-medium tabular-nums text-ink-faint">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-latin text-[1.0625rem] font-bold tracking-[-0.015em] text-ink">{word.word}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-muted">{meaningLine(word)}</span>
        {points.length ? (
          <span className="mt-2 grid gap-0.5 border-l-2 border-line-strong/30 pl-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            {points.map((note, idx) => (
              <span className="min-w-0" key={idx}>{note}</span>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function questionPreview(question: Question): string {
  if (question.kind === "custom") return `${question.label}：${question.items[0].prompt}`.slice(0, 90);
  if ("items" in question) return question.title || question.passage.replace(/__(\d+)__/g, "（$1）").slice(0, 90);
  return question.prompt;
}

function QuestionList({ content }: { content: SetContent }) {
  if (!content.questions.length)
    return (
      <EmptyState
        description="題目由 Agent 依你的單字產生。到「我 › Agent 連線」連接 Claude 等助理，請它幫這個單字集出題。"
        title="還沒有題目"
      />
    );
  const groups = new Map<string, Question[]>();
  for (const question of content.questions) groups.set(question.kind, [...(groups.get(question.kind) ?? []), question]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[...groups].map(([kind, questions]) => (
        <ListGroup key={kind} title={`${KIND_LABELS[kind as Question["kind"]]} · ${questions.length}`}>
          {questions.map((question) => (
            <ListRow
              detail={<span className="flex items-center gap-2 pt-0.5"><Chip>L{question.difficulty}</Chip>{"items" in question ? <span className="font-mono text-xs">{question.items.length} 小題</span> : null}</span>}
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
