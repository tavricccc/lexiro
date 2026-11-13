import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { descriptionPoints, type SetContent } from "@lexiro/contract";
import { AppLink, Button, Chip, ConfirmDialog, EmptyState, Panel } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteWords } from "@/data/library";
import { useLearning } from "@/data/learning";
import { useSet } from "@/data/queries";
import { FAMILIARITY_LABELS } from "@/domain/labels";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { SpeakButton } from "@/ui/speak";
import { StarButton } from "@/ui/star-button";

export default function WordPage() {
  const { setId = "", wordId = "" } = useParams();
  const content = useSet(setId);
  return <Loaded query={content}>{(data) => <WordView content={data} wordId={wordId} />}</Loaded>;
}

function WordView({ content, wordId }: { content: SetContent; wordId: string }) {
  const setId = content.set.id;
  const word = content.words.find((entry) => entry.id === wordId);
  const navigate = useNavigate();
  const online = useOnline();
  const { learning } = useLearning();
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const back = { href: `/app/sets/${setId}`, label: `回到${content.set.name}` };
  if (!word) return <Page back={back} title="找不到單字"><EmptyState description="它可能已經被刪除了。" title="找不到這個單字" /></Page>;
  const questions = content.questions.filter((question) => ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some((id) => word.senses.some((sense) => sense.id === id))).length;
  return (
    <Page
      actions={
        <>
          <StarButton setId={setId} starred={word.starred} word={word.word} wordId={word.id} />
          <Button aria-label="刪除單字" disabled={!online} onClick={() => setRemoving(true)} size="icon"><Trash /></Button>
          <Button asChild><AppLink href={`/app/sets/${setId}/words/${word.id}/edit`}><PencilSimple />編輯</AppLink></Button>
        </>
      }
      back={back}
      documentTitle={word.word}
      title={<span className="flex items-center gap-2"><span className="font-latin text-[2rem] md:text-[2.25rem]" lang="en">{word.word}</span><SpeakButton text={word.word} /></span>}
    >
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
      {questions ? <p className="px-1 text-sm text-ink-faint">有 {questions} 題用到這個單字</p> : null}
      <ConfirmDialog
        confirmLabel="刪除"
        description={questions ? `用到它的 ${questions} 題也會一起刪除。` : undefined}
        onConfirm={async () => {
          setStatus("loading");
          try {
            await deleteWords(setId, [word.id]);
            navigate(`/app/sets/${setId}`, { replace: true });
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
    </Page>
  );
}
