import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Trash } from "@phosphor-icons/react";
import { itemOptions, type Question, type SetContent } from "@lexiro/contract";
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

function Options({ options, answer, whyWrong }: { options: string[]; answer: number; whyWrong?: Record<string, string> }) {
  return (
    <ol className="grid gap-1.5">
      {options.map((option, index) => (
        <li className={cn("grid gap-0.5 rounded-tile px-3 py-2", index === answer ? "bg-positive/12" : "bg-surface-raised")} key={index}>
          <span className="flex items-center gap-2"><span className="w-4 font-latin text-sm text-ink-muted">{index + 1}</span><span className="font-latin">{option}</span>{index === answer ? <Check className="ml-auto text-positive" weight="bold" /> : null}</span>
          {whyWrong?.[option] ? <span className="pl-6 text-[0.8125rem] text-ink-muted">{whyWrong[option]}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Preview({ question, content }: { question: Question; content: SetContent }) {
  const words = new Map(content.words.flatMap((word) => word.senses.map((sense) => [sense.id, `${word.word} ${sense.pos} ${sense.meaning}`] as const)));
  if (question.kind === "vocabulary")
    return (
      <Panel className="grid gap-3">
        <p className="font-latin text-lg leading-relaxed" lang="en">{question.prompt}</p>
        <Options answer={question.answer} options={question.options} whyWrong={question.whyWrong} />
        <p className="text-[0.8125rem] text-ink-muted">練習字義：{words.get(question.senseId)}</p>
        {question.explanation ? <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{question.explanation}</p> : null}
      </Panel>
    );
  return (
    <>
      <Panel className="grid gap-2">
        {question.title ? <h2 className="font-latin text-lg font-semibold" lang="en">{question.title}</h2> : null}
        <p className="whitespace-pre-line font-latin leading-[1.8]" lang="en">
          {passageParts(question.passage).map((part, index) => typeof part === "string" ? <span key={index}>{part}</span> : <span className="mx-0.5 rounded-chip bg-accent-soft px-1.5 font-semibold" key={index}>({part})</span>)}
        </p>
        {question.bank?.length ? <div className="flex flex-wrap gap-1.5 pt-2">{question.bank.map((option) => <Chip className="font-latin" key={option}>{option}</Chip>)}</div> : null}
      </Panel>
      {question.items.map((item, index) => (
        <Panel className="grid gap-3" key={item.id}>
          <p className="text-sm font-semibold text-ink-muted">{item.blank ? `第 ${item.blank} 格` : `第 ${index + 1} 題`}</p>
          {item.prompt ? <p className="font-latin font-medium" lang="en">{item.prompt}</p> : null}
          <Options answer={item.answer} options={itemOptions(question, item)} whyWrong={item.whyWrong} />
          <p className="text-[0.8125rem] text-ink-muted">練習字義：{words.get(item.senseId)}</p>
          {item.explanation ? <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{item.explanation}</p> : null}
        </Panel>
      ))}
      {question.explanation ? <Panel><p className="text-[0.9375rem] leading-relaxed text-ink-muted">{question.explanation}</p></Panel> : null}
    </>
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
        <ConfirmDialog confirmLabel="刪除" description="這一題會從單字集移除。" onConfirm={() => void remove()} status={status} title="刪除這一題？" tone="danger"
          trigger={<HeaderButton aria-label="刪除這一題" disabled={!online}><Trash weight="bold" /></HeaderButton>} />
      ) : undefined}
      back={back}
      description={question ? `${DIFFICULTY[question.difficulty]}難度` : undefined}
      title={question ? KIND_LABELS[question.kind] : "題目"}
    >
      <Loaded query={content}>
        {(data) => question ? <div className="grid gap-4"><Preview content={data} question={question} /></div> : <EmptyState description="可能已經被刪除了。" title="找不到這一題" />}
      </Loaded>
    </Page>
  );
}
