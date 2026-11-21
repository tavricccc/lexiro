import { useState } from "react";
import { useNavigate } from "react-router";
import { PencilSimple, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type SetContent, type Word } from "@lexiro/contract";
import { AppLink, Button, Chip, ConfirmDialog, ProgressBar, Sheet, useNavigation } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteWords } from "@/data/library";
import { useLearning } from "@/data/learning";
import { FAMILIARITY_LABELS } from "@/domain/labels";
import { useOnline } from "@/ui/offline-banner";
import { SpeakButton } from "@/ui/speak";
import { StarButton } from "@/ui/star-button";

function WordBody({ word }: { word: Word }) {
  const { learning } = useLearning();
  return (
    <div className="grid gap-4">
      {word.senses.map((sense, index) => {
        const progress = learning.senses[sense.id];
        const notes = descriptionPoints(sense.description);
        const rate = progress?.answered ? progress.correct / progress.answered : 0;
        return (
          <article className="grid gap-3 border border-line border-t-2 border-t-line-strong bg-surface p-4 md:p-5" key={sense.id}>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-mono text-xs font-bold text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
              <Chip className="font-latin">{sense.pos}</Chip>
              <span className="text-xl font-bold tracking-[-0.02em] text-ink">{sense.meaning}</span>
              {sense.supplementary ? <Chip tone="info">補充</Chip> : null}
            </div>

            <div className="grid gap-1.5 border-y border-line py-2.5">
              <div className="flex items-center justify-between font-mono text-[0.75rem]">
                <span className="font-semibold text-ink-muted">{progress ? FAMILIARITY_LABELS[progress.level] : FAMILIARITY_LABELS[0]}</span>
                <span className="tabular-nums text-ink-faint">
                  {progress ? `答對 ${progress.correct}/${progress.answered}` : "尚未練習"}
                </span>
              </div>
              <ProgressBar className="h-1.5" label="熟悉度" value={progress ? rate : 0} />
            </div>

            {notes.length ? (
              <ul className="grid gap-1.5 border-l-2 border-contrast pl-3.5 text-[0.9375rem] leading-relaxed text-ink-muted">
                {notes.map((note, idx) => <li key={idx}>{note}</li>)}
              </ul>
            ) : null}

            {sense.examples.length ? (
              <ul className="grid divide-y divide-line border border-line bg-surface-raised/60">
                {sense.examples.map((example, idx) => (
                  <li className="flex items-start gap-2 px-3.5 py-2.5" key={idx}>
                    <span className="flex-1 pt-0.5 font-latin text-[0.9375rem] leading-relaxed text-ink" lang="en">{example}</span>
                    <SpeakButton text={example} />
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/** Desktop Master-Detail inline Swiss lexicon inspector panel. */
export function WordInspector({ content, wordId }: { content: SetContent; wordId: string | undefined }) {
  const setId = content.set.id;
  const navigate = useNavigate();
  const online = useOnline();
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const word = content.words.find((entry) => entry.id === wordId);

  if (!word) {
    const starred = content.words.filter((entry) => entry.starred).length;
    const totalSenses = content.words.reduce((sum, entry) => sum + entry.senses.length, 0);
    return (
      <aside className="sticky top-8 hidden border-2 border-line-strong bg-surface p-6 lg:grid lg:gap-6">
        <div className="grid gap-1 border-b border-line pb-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">LEXICON INSPECTOR</span>
          <p className="text-lg font-bold tracking-[-0.02em]">點選左側單字查看完整詞條</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border border-line">
          <div className="p-3.5">
            <span className="block font-mono text-[0.6875rem] text-ink-faint">WORDS</span>
            <span className="mt-1 block font-latin text-2xl font-black tabular-nums">{content.words.length}</span>
          </div>
          <div className="p-3.5">
            <span className="block font-mono text-[0.6875rem] text-ink-faint">SENSES</span>
            <span className="mt-1 block font-latin text-2xl font-black tabular-nums">{totalSenses}</span>
          </div>
          <div className="p-3.5">
            <span className="block font-mono text-[0.6875rem] text-ink-faint">STARRED</span>
            <span className="mt-1 block font-latin text-2xl font-black tabular-nums text-highlight">{starred}</span>
          </div>
        </div>
      </aside>
    );
  }

  const questions = content.questions.filter((question) =>
    ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some((id) => word.senses.some((sense) => sense.id === id)),
  ).length;

  return (
    <>
      <aside className="sticky top-8 hidden max-h-[calc(100svh-4rem)] flex-col border-2 border-line-strong bg-surface lg:flex">
        <header className="flex items-start justify-between gap-3 border-b-2 border-line-strong p-5">
          <div className="min-w-0 grid gap-1">
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-contrast">ENTRY DETAIL</span>
            <h2 className="break-words font-latin text-3xl font-black leading-tight tracking-[-0.035em]" lang="en">{word.word}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SpeakButton text={word.word} />
            <StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} />
            <Button aria-label="關閉詞條" onClick={() => navigate(`/app/sets/${setId}`, { replace: true })} size="icon-sm" variant="ghost">
              <X weight="bold" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas p-5">
          <WordBody word={word} />
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-line-strong bg-surface p-4">
          <Button disabled={!online} onClick={() => setRemoving(true)} size="sm" variant="danger"><Trash weight="bold" />刪除</Button>
          <Button asChild size="sm" variant="primary"><AppLink href={`/app/sets/${setId}/words/${word.id}/edit`}><PencilSimple weight="bold" />編輯詞條</AppLink></Button>
        </footer>
      </aside>
      <ConfirmDialog
        confirmLabel="刪除"
        description={questions ? `用到它的 ${questions} 題也會一起刪除。` : undefined}
        onConfirm={async () => {
          setStatus("loading");
          try {
            await deleteWords(setId, [word.id]);
            navigate(`/app/sets/${setId}`, { replace: true });
            setStatus("idle");
            setRemoving(false);
          } catch (reason) {
            toast.error(errorMessage(reason));
            setStatus("idle");
          }
        }}
        onOpenChange={setRemoving}
        open={removing}
        status={status}
        title={`刪除「${word.word}」？`}
        tone="danger"
      />
    </>
  );
}

/** Mobile / compact drawer for a word's detail. */
export function WordSheet({ content, wordId }: { content: SetContent; wordId: string | undefined }) {
  const setId = content.set.id;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const online = useOnline();
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [shown, setShown] = useState(wordId);
  if (wordId && wordId !== shown) setShown(wordId);
  const word = content.words.find((entry) => entry.id === shown);
  const close = () => (navigation?.back ? navigation.back(`/app/sets/${setId}`) : navigate(`/app/sets/${setId}`, { replace: true }));
  if (!word) return null;
  const questions = content.questions.filter((question) => ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some((id) => word.senses.some((sense) => sense.id === id))).length;
  return (
    <>
      <Sheet
        footer={
          <>
            <Button disabled={!online} onClick={() => setRemoving(true)} variant="danger"><Trash weight="bold" />刪除</Button>
            <Button asChild variant="primary"><AppLink href={`/app/sets/${setId}/words/${word.id}/edit`}><PencilSimple weight="bold" />編輯</AppLink></Button>
          </>
        }
        onOpenChange={(next) => { if (!next) close(); }}
        open={Boolean(wordId)}
        title={<span className="flex items-center gap-2"><span className="font-latin text-2xl font-black" lang="en">{word.word}</span><SpeakButton text={word.word} /><StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} /></span>}
      >
        <WordBody word={word} />
      </Sheet>
      <ConfirmDialog
        confirmLabel="刪除"
        description={questions ? `用到它的 ${questions} 題也會一起刪除。` : undefined}
        onConfirm={async () => {
          setStatus("loading");
          try {
            await deleteWords(setId, [word.id]);
            navigate(`/app/sets/${setId}`, { replace: true });
            setStatus("idle");
          } catch (reason) {
            toast.error(errorMessage(reason));
            setStatus("idle");
          }
        }}
        onOpenChange={setRemoving}
        open={removing}
        status={status}
        title={`刪除「${word.word}」？`}
        tone="danger"
      />
    </>
  );
}
