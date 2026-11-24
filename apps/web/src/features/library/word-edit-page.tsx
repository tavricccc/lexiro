import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import type { SetContent, Word } from "@lexiro/contract";
import { Button, EmptyState, Reveal, useLast } from "design-kit";
import { errorMessage } from "@/data/api";
import { putWords } from "@/data/library";
import { useSet } from "@/data/queries";
import { useLeave } from "@/ui/leave";
import { useOnline } from "@/ui/offline-banner";
import { BottomBar, Loaded, Page } from "@/ui/page";
import { draftInput, draftOf, draftProblem, WordEditor, type WordDraft } from "./word-editor";

export default function WordEditPage() {
  const { setId = "", wordId = "" } = useParams();
  const content = useSet(setId);
  const word = content.data?.words.find((entry) => entry.id === wordId);
  return (
    <Page
      back={{ href: `/app/sets/${setId}/words/${wordId}`, label: word ? `回到 ${word.word}` : "回到單字集" }}
      documentTitle={word ? `編輯 ${word.word}` : undefined}
      title={content.data && !word ? "找不到單字" : "編輯單字"}
    >
      <Loaded query={content}>{(data) => (word ? <Editor content={data} key={word.id} word={word} /> : <EmptyState title="找不到這個單字" />)}</Loaded>
    </Page>
  );
}

function Editor({ content, word }: { content: SetContent; word: Word }) {
  const leave = useLeave();
  const online = useOnline();
  const [draft, setDraft] = useState<WordDraft>(() => draftOf(word));
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const back = `/app/sets/${content.set.id}/words/${word.id}`;
  const removed = word.senses.filter((sense) => !draft.senses.some((entry) => entry.id === sense.id)).length;
  const shownRemoved = useLast(removed || null) ?? 0;
  return (
      <form
        className="grid gap-6"
        onSubmit={async (event) => {
          event.preventDefault();
          const problem = draftProblem(draft);
          if (problem) return setError(problem);
          setStatus("loading");
          try {
            const { removedQuestionIds } = await putWords(content.set.id, [draftInput(draft)]);
            if (removedQuestionIds.length) toast(`移除了用到已刪意思的 ${removedQuestionIds.length} 題`);
            leave.back(back);
          } catch (reason) {
            setError(errorMessage(reason));
            setStatus("idle");
          }
        }}
      >
        <WordEditor draft={draft} onChange={(next) => { setDraft(next); setError(""); }} />
        <Reveal gap="1.5rem" open={removed > 0}><p className="px-1 text-sm text-caution">刪掉的 {shownRemoved} 個意思，相關題目會一起移除。</p></Reveal>
        {error ? <p className="message-in px-1 text-sm text-danger" role="alert">{error}</p> : null}
        <BottomBar>
          <div className="glass-float flex justify-end gap-2 rounded-full p-1.5">
            <Button onClick={() => leave.back(back)} variant="ghost">取消</Button>
            <Button disabled={!online} status={status} type="submit" variant="primary">儲存</Button>
          </div>
        </BottomBar>
      </form>
  );
}
