import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sword } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { PracticeTask, SetContent } from "@lexiro/contract";
import { AppLink, Button, Field, Input, ListGroup, ListRow, Panel, Segmented, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { useAuth } from "@/data/auth";
import { useLearning } from "@/data/learning";
import { keys, useLibrary } from "@/data/queries";
import { TASK_LABELS } from "@/domain/labels";
import { availableTasks, buildRound } from "@/domain/practice";
import { ROOM_CODE, roomQuestions } from "@/domain/room";
import { orderedSets } from "@/features/library/library-page";
import { LabeledSelect } from "@/ui/labeled-select";
import { Page } from "@/ui/page";

const AMOUNTS = ["10", "20", "30"] as const;
const SECONDS = ["auto", "15", "25", "40"] as const;
type Seconds = (typeof SECONDS)[number];

/** Host a match from one of your sets, or join someone else's with a code. */
export default function RoomsPage() {
  const navigate = useNavigate();
  const { account } = useAuth();
  const active = useQuery({ queryKey: ["rooms", "active"], queryFn: () => api<{ room: { code: string; title: string; phase: string } | null }>("/rooms/active") });
  const [code, setCode] = useState("");
  const normalized = code.trim().toUpperCase();
  const join = () => {
    if (!ROOM_CODE.test(normalized)) return toast.error("房間代碼是 6 個英數字。");
    navigate(`/app/rooms/${normalized}`);
  };
  return (
    <Page description="用同一組題目和朋友即時比快、比準。" title="對戰">
      {active.data?.room ? (
        <Panel className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">你開的房間還在進行</p>
            <p className="truncate text-sm text-ink-muted">{active.data.room.title} · <span className="font-latin">{active.data.room.code}</span></p>
          </div>
          <Button asChild variant="primary"><AppLink href={`/app/rooms/${active.data.room.code}`}>回到房間</AppLink></Button>
        </Panel>
      ) : null}
      <Panel className="grid gap-3">
        <h2 className="font-semibold">加入房間</h2>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); join(); }}>
          <Input aria-label="房間代碼" autoCapitalize="characters" autoComplete="off" className="flex-1 font-latin text-lg uppercase tracking-[0.3em]" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, ""))} placeholder="ABC234" spellCheck={false} value={code} />
          <Button disabled={normalized.length !== 6} type="submit" variant="primary"><ArrowRight weight="bold" />加入</Button>
        </form>
      </Panel>
      {account ? <HostForm name={account.name} /> : null}
    </Page>
  );
}

function HostForm({ name: defaultName }: { name: string }) {
  const navigate = useNavigate();
  const library = useLibrary();
  const { learning } = useLearning();
  const sets = orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0);
  const [setId, setSetId] = useState("");
  const chosen = setId || sets[0]?.id || "";
  const content = useQuery({ queryKey: keys.set(chosen), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(chosen)}`), enabled: Boolean(chosen) });
  const tasks = useMemo(() => (content.data ? availableTasks([content.data]) : []), [content.data]);
  const [task, setTask] = useState<PracticeTask | "">("");
  const picked = task && tasks.includes(task) ? task : tasks[0];
  const [amount, setAmount] = useState<string>("10");
  const [seconds, setSeconds] = useState<Seconds>("auto");
  const [name, setName] = useState(defaultName.slice(0, 40));
  const [status, setStatus] = useState<ActionStatus>("idle");
  if (library.data && !sets.length)
    return <ListGroup title="開房間"><ListRow detail="先在單字集裡加一些單字。" label="還沒有可以出題的單字集" /></ListGroup>;
  const set = sets.find((entry) => entry.id === chosen);
  const host = async () => {
    if (!content.data || !picked || !set) return;
    const questions = roomQuestions(buildRound({ contents: [content.data], tasks: [picked], amount: Number(amount), focus: "all", learning }));
    if (!questions.length) return toast.error("這個題型在這個單字集裡沒有可以出的題目。");
    setStatus("loading");
    try {
      const { code } = await api<{ code: string }>("/rooms", { method: "POST", json: { name: name.trim() || defaultName, title: `${set.name} · ${TASK_LABELS[picked]}`.slice(0, 120), ...(seconds === "auto" ? {} : { seconds: Number(seconds) }), questions } });
      navigate(`/app/rooms/${code}`);
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  return (
    <Panel className="grid gap-5">
      <h2 className="font-semibold">開房間</h2>
      <Field label="你的暱稱">
        {({ id }) => <Input id={id} maxLength={40} onChange={(event) => setName(event.target.value)} value={name} />}
      </Field>
      {sets.length ? <LabeledSelect label="單字集" onChange={setSetId} options={sets.map((entry) => ({ value: entry.id, label: entry.name }))} value={chosen} /> : null}
      {tasks.length ? <LabeledSelect label="題型" onChange={(value) => setTask(value as PracticeTask)} options={tasks.map((value) => ({ value, label: TASK_LABELS[value] }))} value={picked ?? ""} /> : <p className="px-1 text-sm text-ink-faint">正在讀取單字集…</p>}
      <section className="grid gap-2">
        <h3 className="px-1 text-sm font-medium text-ink-muted">題數</h3>
        <Segmented label="題數" onChange={setAmount} options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))} value={amount} />
      </section>
      <section className="grid gap-2">
        <h3 className="px-1 text-sm font-medium text-ink-muted">每題秒數</h3>
        <Segmented label="每題秒數" onChange={setSeconds} options={SECONDS.map((value) => ({ value, label: value === "auto" ? "依題型" : `${value} 秒` }))} value={seconds} />
      </section>
      <Button className="justify-self-start" disabled={!picked || !content.data} onClick={() => void host()} size="lg" status={status} variant="primary"><Sword weight="fill" />開房間</Button>
    </Panel>
  );
}
