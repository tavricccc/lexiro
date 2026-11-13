import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { SetContent } from "@lexiro/contract";
import { Button, EmptyState } from "design-kit";
import { errorMessage } from "@/data/api";
import { putWords } from "@/data/library";
import { useSet } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { draftInput, draftOf, draftProblem, WordEditor, type WordDraft } from "./word-editor";

export default function WordEditPage() {
  const { setId = "", wordId = "" } = useParams();
  const content = useSet(setId);
  return <Loaded query={content}>{(data) => <Editor content={data} wordId={wordId} />}</Loaded>;
}

function Editor({ content, wordId }: { content: SetContent; wordId: string }) {
  const word = content.words.find((entry) => entry.id === wordId);
  const navigate = useNavigate();
  const online = useOnline();
  const [draft, setDraft] = useState<WordDraft | null>(word ? draftOf(word) : null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const back = `/app/sets/${content.set.id}/words/${wordId}`;
  if (!word || !draft) return <Page back={{ href: `/app/sets/${content.set.id}`, label: "回到單字集" }} title="找不到單字"><EmptyState title="找不到這個單字" /></Page>;
  const removed = word.senses.filter((sense) => !draft.senses.some((entry) => entry.id === sense.id)).length;
  return (
    <Page back={{ href: back, label: `回到 ${word.word}` }} documentTitle={`編輯 ${word.word}`} title="編輯單字">
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
            navigate(back, { replace: true });
          } catch (reason) {
            setError(errorMessage(reason));
            setStatus("idle");
          }
        }}
      >
        <WordEditor draft={draft} onChange={(next) => { setDraft(next); setError(""); }} />
        {removed ? <p className="px-1 text-sm text-caution">刪掉的 {removed} 個意思，相關題目會一起移除。</p> : null}
        {error ? <p className="message-in px-1 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="glass-float sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 flex justify-end gap-2 rounded-full p-1.5 md:bottom-6">
          <Button onClick={() => navigate(back)} variant="ghost">取消</Button>
          <Button disabled={!online} status={status} type="submit" variant="primary">儲存</Button>
        </div>
      </form>
    </Page>
  );
}
