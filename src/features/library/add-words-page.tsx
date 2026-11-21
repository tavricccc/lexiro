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
    <Page back={{ href: `/app/sets/${setId}`, label: "回到單字集" }} kicker="LEXICON // INGEST" title="新增單字" width="wide">
      <Loaded query={content}>{(data) => <AddWords content={data} />}</Loaded>
    </Page>
  );
}

function AddWords({ content }: { content: SetContent }) {
  const [mode, setMode] = useState<"one" | "list">("one");
  return (
    <div className="grid gap-6">
      <Segmented label="新增方式" onChange={setMode} options={[{ value: "one", label: "逐筆輸入" }, { value: "list", label: "批次貼上清單" }]} value={mode} />
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
    <form className="grid max-w-3xl gap-6" onSubmit={(event) => { event.preventDefault(); void save(true); }}>
      <WordEditor autoFocus draft={draft} key={draft.senses[0]?.key} onChange={(next) => { setDraft(next); setError(""); }} />
      {existing ? <p className="border-l-2 border-info pl-3 text-sm text-info">這個單字集已經有「{existing.word}」，新的意思會加到它下面。</p> : null}
      {error ? <p className="message-in border-l-2 border-danger pl-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
      <div className="sticky bottom-[calc(var(--safe-bottom)+0.75rem)] z-30 flex justify-end gap-2 border-2 border-line-strong bg-surface p-2.5 shadow-float md:bottom-6">
        <Button disabled={!online || status !== "idle"} onClick={() => void save(false)} variant="secondary">儲存並返回</Button>
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
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="grid gap-4 lg:col-span-7">
        <Textarea
          aria-label="單字清單"
          className="min-h-72 border-2 border-line-strong font-mono text-sm leading-relaxed"
          onChange={(event) => setText(event.target.value)}
          placeholder={"一行一個單字，例如：\nrescue\tv.\t救援\nbank, n., 銀行；河岸\ngive up phr. v. 放棄"}
          spellCheck={false}
          value={text}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-48">
            <LabeledSelect label="預設詞性" onChange={setPos} options={PARTS_OF_SPEECH.map((value) => ({ value, label: value }))} value={pos} />
          </div>
          <Button
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
      </div>

      {/* Live Parser Readout Sidebar */}
      <Panel className="grid gap-4 border-t-2 border-t-line-strong lg:sticky lg:top-8 lg:col-span-5">
        <div className="flex items-baseline justify-between border-b border-line pb-2.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">PARSER OUTPUT</span>
          <span className="font-mono text-xs font-bold tabular-nums text-contrast">{parsed.words.length} READY</span>
        </div>
        {parsed.words.length || parsed.problems.length ? (
          <div className="grid gap-3 text-sm">
            <p className="font-medium">
              讀到 <span className="font-mono font-bold text-ink">{parsed.words.length}</span> 個單字
              {parsed.words.length - fresh ? `，其中 ${parsed.words.length - fresh} 個將合併新意思` : ""}。
            </p>
            {parsed.problems.length ? (
              <ul className="grid gap-1.5 border-l-2 border-danger pl-3 font-mono text-xs text-danger">
                {parsed.problems.slice(0, 6).map((problem) => <li key={problem.line}>L{problem.line}: {problem.error}（{problem.text}）</li>)}
                {parsed.problems.length > 6 ? <li>+{parsed.problems.length - 6} 行錯誤</li> : null}
              </ul>
            ) : null}
            {parsed.words.length ? (
              <ul className="max-h-64 divide-y divide-line overflow-y-auto border border-line text-xs">
                {parsed.words.slice(0, 20).map((entry, idx) => (
                  <li className="flex items-baseline gap-2.5 px-3 py-2" key={idx}>
                    <span className="font-latin font-bold text-ink">{entry.word}</span>
                    <span className="font-mono text-ink-faint">{entry.senses[0]?.pos}</span>
                    <span className="truncate text-ink-muted">{entry.senses.map((s) => s.meaning).join("；")}</span>
                  </li>
                ))}
                {parsed.words.length > 20 ? <li className="px-3 py-2 font-mono text-ink-faint">+{parsed.words.length - 20} 更多…</li> : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="font-mono text-xs leading-relaxed text-ink-faint">
            支援 Tab、逗號或空白分隔。貼上後右側會即時預覽解析結果與格式錯誤行。
          </p>
        )}
      </Panel>
    </div>
  );
}
