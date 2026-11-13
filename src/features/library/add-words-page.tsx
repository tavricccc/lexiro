import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { PARTS_OF_SPEECH, normalizeWord, type SetContent } from "@lexiro/contract";
import { Button, Panel, Segmented, Textarea } from "design-kit";
import { errorMessage } from "@/data/api";
import { putWords } from "@/data/library";
import { useSet } from "@/data/queries";
import { parseBulk } from "@/domain/bulk";
import { LabeledSelect } from "@/ui/labeled-select";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { draftInput, draftProblem, emptyWord, WordEditor, type WordDraft } from "./word-editor";

export default function AddWordsPage() {
  const { setId = "" } = useParams();
  const content = useSet(setId);
  return (
    <Page back={{ href: `/app/sets/${setId}`, label: "回到單字集" }} title="新增單字">
      <Loaded query={content}>{(data) => <AddWords content={data} />}</Loaded>
    </Page>
  );
}

function AddWords({ content }: { content: SetContent }) {
  const [mode, setMode] = useState<"one" | "list">("one");
  return (
    <div className="grid gap-6">
      <Segmented label="新增方式" onChange={setMode} options={[{ value: "one", label: "一個一個加" }, { value: "list", label: "貼上清單" }]} value={mode} />
      {mode === "one" ? <AddOne content={content} /> : <AddList content={content} />}
    </div>
  );
}

function AddOne({ content }: { content: SetContent }) {
  const online = useOnline();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<WordDraft>(emptyWord);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const existing = content.words.find((word) => normalizeWord(word.word) === normalizeWord(draft.word));
  const save = async (again: boolean) => {
    const problem = draftProblem(draft);
    if (problem) return setError(problem);
    setStatus("loading");
    try {
      await putWords(content.set.id, [draftInput(draft)]);
      toast.success(existing ? `已把新的意思加到「${existing.word}」` : `已加入「${draft.word.trim()}」`);
      if (again) { setDraft(emptyWord()); setError(""); }
      else navigate(`/app/sets/${content.set.id}`, { replace: true });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setStatus("idle");
    }
  };
  return (
    <form className="grid gap-6" onSubmit={(event) => { event.preventDefault(); void save(true); }}>
      <WordEditor autoFocus draft={draft} key={draft.senses[0]?.key} onChange={(next) => { setDraft(next); setError(""); }} />
      {existing ? <p className="px-1 text-sm text-info">這個單字集已經有「{existing.word}」，新的意思會加到它下面。</p> : null}
      {error ? <p className="message-in px-1 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="glass-float sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 flex justify-end gap-2 rounded-full p-1.5 md:bottom-6">
        <Button disabled={!online || status !== "idle"} onClick={() => void save(false)} variant="ghost">儲存並返回</Button>
        <Button disabled={!online} status={status} type="submit" variant="primary">儲存，再加一個</Button>
      </div>
    </form>
  );
}

function AddList({ content }: { content: SetContent }) {
  const online = useOnline();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [pos, setPos] = useState("n.");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const parsed = useMemo(() => parseBulk(text, pos), [text, pos]);
  const known = new Set(content.words.map((word) => normalizeWord(word.word)));
  const fresh = parsed.words.filter((word) => !known.has(normalizeWord(word.word))).length;
  return (
    <div className="grid gap-5">
      <Textarea
        aria-label="單字清單"
        className="min-h-56 font-latin"
        onChange={(event) => setText(event.target.value)}
        placeholder={"一行一個單字，例如：\nrescue\tv.\t救援\nbank, n., 銀行；河岸\ngive up phr. v. 放棄"}
        spellCheck={false}
        value={text}
      />
      <div className="max-w-48"><LabeledSelect label="沒寫詞性時當作" onChange={setPos} options={PARTS_OF_SPEECH.map((value) => ({ value, label: value }))} value={pos} /></div>
      {parsed.words.length || parsed.problems.length ? (
        <Panel className="grid gap-2 text-[0.9375rem]">
          <p>讀到 <span className="font-latin font-semibold">{parsed.words.length}</span> 個單字{parsed.words.length - fresh ? `，其中 ${parsed.words.length - fresh} 個已在單字集，會補上新的意思` : ""}。</p>
          {parsed.problems.length ? (
            <ul className="grid gap-1 text-sm text-danger">
              {parsed.problems.slice(0, 5).map((problem) => <li key={problem.line}>第 {problem.line} 行：{problem.error}（{problem.text}）</li>)}
              {parsed.problems.length > 5 ? <li>還有 {parsed.problems.length - 5} 行</li> : null}
            </ul>
          ) : null}
        </Panel>
      ) : null}
      <Button
        className="justify-self-start"
        disabled={!online || !parsed.words.length}
        onClick={async () => {
          setStatus("loading");
          try {
            for (let at = 0; at < parsed.words.length; at += 200) await putWords(content.set.id, parsed.words.slice(at, at + 200));
            toast.success(`已加入 ${parsed.words.length} 個單字`);
            navigate(`/app/sets/${content.set.id}`, { replace: true });
          } catch (reason) {
            toast.error(errorMessage(reason));
            setStatus("idle");
          }
        }}
        size="lg"
        status={status}
        variant="primary"
      >
        加入 {parsed.words.length || ""} 個單字
      </Button>
    </div>
  );
}
