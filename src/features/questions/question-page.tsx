import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Trash } from "@phosphor-icons/react";
import { itemOptions, type CustomItem, type CustomQuestion, type Question, type SetContent } from "@lexiro/contract";
import { toast } from "sonner";
import { Chip, ConfirmDialog, EmptyState, HeaderButton, Panel, cn, type ActionStatus } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteQuestions } from "@/data/library";
import { useSet } from "@/data/queries";
import { KIND_LABELS } from "@/domain/labels";
import { passageParts } from "@/domain/practice";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";

const DIFFICULTY = ["", "簡單", "中等", "困難"];

function Options({ options, answer, whyWrong }: { options: string[]; answer: number | number[]; whyWrong?: Record<string, string> }) {
  const right = (index: number) => (Array.isArray(answer) ? answer.includes(index) : index === answer);
  return (
    <ol className="grid divide-y divide-line border border-line">
      {options.map((option, index) => (
        <li className={cn("grid gap-1 px-3.5 py-2.5", right(index) ? "bg-positive/10" : "bg-surface")} key={index}>
          <span className="flex items-center gap-3">
            <span className="w-4 font-mono text-xs font-bold text-ink-faint">{index + 1}</span>
            <span className="font-latin font-medium">{option}</span>
            {right(index) ? <Check className="ml-auto text-positive" weight="bold" /> : null}
          </span>
          {whyWrong?.[option] ? <span className="pl-7 text-xs text-ink-muted">{whyWrong[option]}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function CustomAnswer({ item }: { item: CustomItem }) {
  switch (item.mode) {
    case "single": return <Options answer={item.answer} options={item.options} whyWrong={item.whyWrong} />;
    case "multiple": return <Options answer={item.answers} options={item.options} whyWrong={item.whyWrong} />;
    case "input":
      return <div className="flex flex-wrap gap-1.5">{item.accepted.map((answer) => <Chip className="font-latin" key={answer} tone="positive">{answer}</Chip>)}</div>;
    case "order":
      return <ol className="grid divide-y divide-line border border-line">{item.pieces.map((piece, index) => <li className="flex gap-3 bg-surface px-3.5 py-2" key={index}><span className="w-4 font-mono text-xs font-bold text-ink-faint">{index + 1}</span><span className="font-latin">{piece}</span></li>)}</ol>;
    case "match":
      return <ul className="grid divide-y divide-line border border-line">{item.pairs.map(([left, right], index) => <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-surface px-3.5 py-2" key={index}><span className="font-latin font-medium">{left}</span><span aria-hidden className="font-mono text-xs text-ink-faint">→</span><span className="font-latin">{right}</span></li>)}</ul>;
  }
}

function CustomPreview({ question, words }: { question: CustomQuestion; words: Map<string, string> }) {
  const hasLeft = Boolean(question.instructions || question.passage);
  return (
    <div className={cn("grid items-start gap-6", hasLeft && "lg:grid-cols-12")}>
      {hasLeft ? (
        <Panel className="grid gap-3 border-t-2 border-t-line-strong lg:sticky lg:top-8 lg:col-span-6">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">STIMULUS</span>
          {question.instructions ? <p className="text-sm text-ink-muted">{question.instructions}</p> : null}
          {question.passage ? <p className="whitespace-pre-line font-latin leading-[1.85]" lang="en">{question.passage}</p> : null}
        </Panel>
      ) : null}
      <div className={cn("grid gap-4", hasLeft ? "lg:col-span-6" : "max-w-3xl")}>
        {question.items.map((item, index) => (
          <Panel className="grid gap-3 border-t-2 border-t-line-strong" key={item.id}>
            {question.items.length > 1 ? <p className="font-mono text-xs font-bold text-ink-muted">ITEM {String(index + 1).padStart(2, "0")}</p> : null}
            <p className="font-latin text-lg font-bold" lang="en">{item.prompt}</p>
            <CustomAnswer item={item} />
            <p className="font-mono text-xs text-ink-muted">目標字義：{words.get(item.senseId)}</p>
            {item.explanation ? <p className="border-l-2 border-line-strong/30 pl-3 text-sm leading-relaxed text-ink-muted">{item.explanation}</p> : null}
          </Panel>
        ))}
        {question.explanation ? <Panel><p className="text-sm leading-relaxed text-ink-muted">{question.explanation}</p></Panel> : null}
      </div>
    </div>
  );
}

function Preview({ question, content }: { question: Question; content: SetContent }) {
  const words = new Map(content.words.flatMap((word) => word.senses.map((sense) => [sense.id, `${word.word} ${sense.pos} ${sense.meaning}`] as const)));
  if (question.kind === "custom") return <CustomPreview question={question} words={words} />;
  if (question.kind === "vocabulary")
    return (
      <Panel className="grid max-w-3xl gap-4 border-t-2 border-t-line-strong">
        <p className="font-latin text-xl font-medium leading-relaxed" lang="en">{question.prompt}</p>
        <Options answer={question.answer} options={question.options} whyWrong={question.whyWrong} />
        <p className="font-mono text-xs text-ink-muted">目標字義：{words.get(question.senseId)}</p>
        {question.explanation ? <p className="border-l-2 border-line-strong/30 pl-3 text-sm leading-relaxed text-ink-muted">{question.explanation}</p> : null}
      </Panel>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <Panel className="grid gap-3 border-t-2 border-t-line-strong lg:sticky lg:top-8 lg:col-span-6">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">PASSAGE</span>
        {question.title ? <h2 className="font-latin text-xl font-extrabold" lang="en">{question.title}</h2> : null}
        <p className="whitespace-pre-line font-latin leading-[1.85]" lang="en">
          {passageParts(question.passage).map((part, index) => typeof part === "string" ? <span key={index}>{part}</span> : <span className="mx-0.5 border border-contrast bg-accent-soft px-1.5 font-mono text-sm font-bold text-accent-ink" key={index}>({part})</span>)}
        </p>
        {question.bank?.length ? <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">{question.bank.map((option) => <Chip className="font-latin" key={option}>{option}</Chip>)}</div> : null}
      </Panel>
      <div className="grid gap-4 lg:col-span-6">
        {question.items.map((item, index) => (
          <Panel className="grid gap-3 border-t-2 border-t-line-strong" key={item.id}>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{item.blank ? `BLANK ${item.blank}` : `ITEM ${String(index + 1).padStart(2, "0")}`}</p>
            {item.prompt ? <p className="font-latin text-base font-bold" lang="en">{item.prompt}</p> : null}
            <Options answer={item.answer} options={itemOptions(question, item)} whyWrong={item.whyWrong} />
            <p className="font-mono text-xs text-ink-muted">目標字義：{words.get(item.senseId)}</p>
            {item.explanation ? <p className="border-l-2 border-line-strong/30 pl-3 text-sm leading-relaxed text-ink-muted">{item.explanation}</p> : null}
          </Panel>
        ))}
        {question.explanation ? <Panel><p className="text-sm leading-relaxed text-ink-muted">{question.explanation}</p></Panel> : null}
      </div>
    </div>
  );
}

export default function QuestionPage() {
  const { setId = "", questionId = "" } = useParams();
  const content = useSet(setId);
  const navigate = useNavigate();
  const online = useOnline();
  const [status, setStatus] = useState<ActionStatus>("idle");
  const back = { href: `/app/sets/${setId}?tab=questions`, label: content.data?.set.name ?? "單字集" };
  const remove = async () => {
    setStatus("loading");
    try {
      await deleteQuestions(setId, [questionId]);
      navigate(back.href, { replace: true });
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  const question = content.data?.questions.find((entry) => entry.id === questionId);
  return (
    <Page
      actions={question ? (
        <ConfirmDialog
          confirmLabel="刪除"
          description="這一題會從單字集移除。"
          onConfirm={() => void remove()}
          status={status}
          title="刪除這一題？"
          tone="danger"
          trigger={<HeaderButton aria-label="刪除這一題" disabled={!online}><Trash weight="bold" /></HeaderButton>}
        />
      ) : undefined}
      back={back}
      kicker={question ? `QUESTION // ${DIFFICULTY[question.difficulty]}難度` : "QUESTION"}
      title={question ? (question.kind === "custom" ? question.label : KIND_LABELS[question.kind]) : "題目"}
    >
      <Loaded query={content}>
        {(data) => question ? <Preview content={data} question={question} /> : <EmptyState description="可能已經被刪除了。" title="找不到這一題" />}
      </Loaded>
    </Page>
  );
}
