import { useState } from "react";
import { useParams } from "react-router";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type SetContent, type Word } from "@lexiro/contract";
import { AppLink, Button, Chip, ConfirmDialog, EmptyState, Panel } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteWords } from "@/data/library";
import { useLearning } from "@/data/learning";
import { useSet } from "@/data/queries";
import { FAMILIARITY_LABELS } from "@/domain/labels";
import { useLeave } from "@/ui/leave";
import { useOnline } from "@/ui/offline-banner";
import { BottomBar, Loaded, Page } from "@/ui/page";
import { SpeakButton } from "@/ui/speak";
import { StarButton } from "@/ui/star-button";

/** A word's detail, a sheet over whatever list it was opened from. */
export default function WordPage() {
  const { setId = "", wordId = "" } = useParams();
  const content = useSet(setId);
  const found = content.data?.words.find((entry) => entry.id === wordId);
  // A word just deleted is still shown while its sheet goes away.
  const [last, setLast] = useState(found);
  if (found && found !== last) setLast(found);
  const word = found ?? (last?.id === wordId ? last : undefined);
  return (
    <Page
      actions={word ? <StarButton inHeader setId={setId} starred={word.starred} word={word.word} wordId={word.id} /> : undefined}
      back={{ href: `/app/sets/${setId}`, label: "回到單字集" }}
      documentTitle={word?.word}
      title={word ? <span className="flex min-w-0 items-center justify-center gap-1"><span className="truncate font-latin text-[1.375rem] font-bold" lang="en">{word.word}</span><SpeakButton text={word.word} /></span> : "單字"}
    >
      <Loaded query={content}>{(data) => (word ? <Detail content={data} word={word} /> : <EmptyState description="可能已經被刪除了。" title="找不到這個單字" />)}</Loaded>
    </Page>
  );
}

function Detail({ content, word }: { content: SetContent; word: Word }) {
  const setId = content.set.id;
  const leave = useLeave();
  const online = useOnline();
  const { learning } = useLearning();
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const questions = content.questions.filter((question) => ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some((id) => word.senses.some((sense) => sense.id === id))).length;
  return (
    <>
      <div className="grid gap-3">
        {word.senses.map((sense) => {
          const progress = learning.senses[sense.id];
          const notes = descriptionPoints(sense.description);
          return (
            <Panel className="grid gap-3" key={sense.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip className="font-latin">{sense.pos}</Chip>
                <span className="text-lg font-semibold">{sense.meaning}</span>
                {sense.supplementary ? <Chip tone="info">補充</Chip> : null}
                <span className="ml-auto text-[0.8125rem] text-ink-faint">
                  {progress ? `${FAMILIARITY_LABELS[progress.level]} · 答對 ${progress.correct}/${progress.answered}` : FAMILIARITY_LABELS[0]}
                </span>
              </div>
              {notes.length ? (
                <ul className="grid list-disc gap-1 pl-5 text-[0.9375rem] leading-relaxed text-ink-muted marker:text-ink-faint">
                  {notes.map((note, index) => <li key={index}>{note}</li>)}
                </ul>
              ) : null}
              {sense.examples.length ? (
                <ul className="grid gap-2">
                  {sense.examples.map((example, index) => (
                    <li className="flex items-start gap-1 rounded-tile bg-surface-raised py-2 pl-3.5 pr-1" key={index}>
                      <span className="flex-1 pt-1 font-latin text-[0.9375rem] leading-relaxed" lang="en">{example}</span>
                      <SpeakButton text={example} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          );
        })}
      </div>
      <BottomBar>
        <div className="glass-float flex justify-end gap-2 rounded-full p-1.5">
          <Button disabled={!online} onClick={() => setRemoving(true)} variant="danger"><Trash weight="bold" />刪除</Button>
          <Button asChild variant="primary"><AppLink href={`/app/sets/${setId}/words/${word.id}/edit`}><PencilSimple weight="bold" />編輯</AppLink></Button>
        </div>
      </BottomBar>
      <ConfirmDialog
        confirmLabel="刪除"
        description={questions ? `用到它的 ${questions} 題也會一起刪除。` : undefined}
        onConfirm={async () => {
          setStatus("loading");
          try {
            await deleteWords(setId, [word.id]);
            setRemoving(false);
            leave.back(`/app/sets/${setId}`);
          } catch (reason) {
            toast.error(errorMessage(reason));
          } finally {
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
