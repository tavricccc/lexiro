import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { CheckSquare, Copy, DotsThree, GearSix, MagnifyingGlass, Play, Plus, ShareNetwork, Star, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type Question, type SetContent, type Word } from "@lexiro/contract";
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

type Tab = "words" | "questions";

export default function SetPage() {
  const { setId = "" } = useParams();
  const content = useSet(setId);
  const [share, setShare] = useState(false);
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
          <HeaderButton aria-label="新增單字" asChild><AppLink href={`/app/sets/${setId}/add`}><Plus weight="bold" /></AppLink></HeaderButton>
          {content.data.words.length ? (
            <HeaderButton aria-label="練習" asChild prominent><AppLink href={`/app/practice?set=${setId}`}><Play weight="fill" /></AppLink></HeaderButton>
          ) : null}
        </>
      ) : null}
      back={{ href: "/app/library", label: "回到我的單字" }}
      description={content.data ? `${content.data.words.length} 個單字 · ${content.data.questions.length} 題` : undefined}
      documentTitle={name}
      title={content.data ? (
        <span className="flex items-center gap-3"><SetIcon className="size-9 [&_svg]:size-5" hue={content.data.set.hue} icon={content.data.set.icon} />{name}</span>
      ) : name}
    >
      <Loaded query={content}>{(data) => <SetBody content={data} />}</Loaded>
      {content.data ? <ShareSheet onOpenChange={setShare} open={share} set={content.data.set} /> : null}
    </Page>
  );
}

function SetBody({ content }: { content: SetContent }) {
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
    <div className="grid gap-4">
      <Segmented
        label="內容"
        onChange={setTab}
        options={[{ value: "words", label: `單字 ${content.words.length}` }, { value: "questions", label: `題目 ${content.questions.length}` }]}
        value={tab}
      />
      {tab === "words" ? <WordList content={content} /> : <QuestionList content={content} />}
    </div>
  );
}

/** "n. 銀行；河岸 · v. 存錢": every meaning on one line, grouped by part of speech. */
export function meaningLine(word: Word): string {
  const groups = new Map<string, string[]>();
  for (const sense of word.senses) groups.set(sense.pos, [...(groups.get(sense.pos) ?? []), sense.meaning]);
  return [...groups].map(([pos, meanings]) => `${pos} ${meanings.join("；")}`).join(" · ");
}

function WordList({ content }: { content: SetContent }) {
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
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
          <Input aria-label="搜尋單字" className="pl-11" onChange={(event) => setQuery(event.target.value)} placeholder="搜尋英文或中文" type="search" value={query} />
        </div>
        {starred ? (
          <Button aria-pressed={starredOnly} className={cn(starredOnly && "text-highlight")} onClick={() => setStarredOnly(!starredOnly)}>
            <Star weight={starredOnly ? "fill" : "regular"} />{starred}
          </Button>
        ) : null}
        <Button aria-label={selected ? "結束選取" : "選取單字"} aria-pressed={selected !== null} disabled={!online} onClick={() => setSelected(selected ? null : new Set())} size="icon">
          {selected ? <X weight="bold" /> : <CheckSquare />}
        </Button>
      </div>
      {words.length ? (
        <ListGroup label="單字">
          {words.map((word) => selected ? (
            <li key={word.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3.5 px-4 py-2.5 hover:bg-surface-raised">
                <input checked={selected.has(word.id)} className="size-5 accent-[var(--contrast)]" onChange={() => toggle(word.id)} type="checkbox" />
                <WordText word={word} />
              </label>
            </li>
          ) : (
            <li className="flex items-center" key={word.id}>
              <AppLink className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 outline-none transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised" href={`/app/sets/${setId}/words/${word.id}`}>
                <WordText word={word} />
              </AppLink>
              <span className="pr-2"><StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} /></span>
            </li>
          ))}
        </ListGroup>
      ) : <p className="py-6 text-center text-[0.9375rem] text-ink-muted">沒有符合的單字</p>}
      {selected ? (
        <div className="bar-in glass-float sticky bottom-[calc(var(--bottom-nav-gap)+0.5rem)] z-30 flex items-center gap-2 rounded-full p-1.5 pl-5 md:bottom-6">
          <span className="flex-1 text-[0.9375rem] font-medium">已選 <span className="font-latin">{selected.size}</span> 個</span>
          <Button disabled={!selected.size} onClick={() => setCopying(true)} size="sm"><Copy />複製到…</Button>
          <Button disabled={!selected.size} onClick={() => setRemoving(true)} size="sm" variant="danger"><Trash />刪除</Button>
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

/** A word's notes: every sense's description points, in order. */
const notes = (word: Word) => word.senses.flatMap((sense) => descriptionPoints(sense.description));

function WordText({ word }: { word: Word }) {
  const points = notes(word);
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-latin text-[1.0625rem] font-semibold">{word.word}</span>
      <span className="block truncate text-[0.8125rem] text-ink-muted">{meaningLine(word)}</span>
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
