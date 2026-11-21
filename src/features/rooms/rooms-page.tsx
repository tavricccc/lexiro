import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Minus, Sword } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { PracticeTask, SetContent } from "@lexiro/contract";
import {
  OTPInput,
  OTPInputGroup,
  OTPInputSeparator,
  OTPInputSlot,
} from "@ui-sdk/react/otp-input";
import { AppLink, Button, Field, Input, ListGroup, ListRow, Segmented, type ActionStatus } from "design-kit";
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

const slotClass =
  "relative grid h-14 flex-1 place-items-center border-2 border-line-strong/35 bg-canvas font-mono text-2xl font-black uppercase text-ink transition-[border-color,background-color] duration-[var(--motion-control)] data-filled:border-line-strong data-filled:bg-surface data-active:border-contrast data-active:bg-accent-soft";

export default function RoomsPage() {
  const navigate = useNavigate();
  const { account } = useAuth();
  const active = useQuery({ queryKey: ["rooms", "active"], queryFn: () => api<{ room: { code: string; title: string; phase: string } | null }>("/rooms/active") });
  const [code, setCode] = useState("");
  const normalized = code.trim().toUpperCase();
  const join = (target = normalized) => {
    const clean = target.trim().toUpperCase();
    if (!ROOM_CODE.test(clean)) return toast.error("房間代碼是 6 個英數字。");
    navigate(`/app/rooms/${clean}`);
  };

  return (
    <Page description="同一組題目，即時競速與準度對決。" kicker="04 // LIVE ARENA" title="對戰">
      {active.data?.room ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-contrast bg-contrast p-5 text-on-contrast">
          <div className="min-w-0">
            <span className="block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-on-contrast/80">ACTIVE ROOM // {active.data.room.code}</span>
            <p className="truncate text-lg font-bold">{active.data.room.title}</p>
          </div>
          <Button asChild className="border-on-contrast bg-on-contrast text-contrast hover:border-ink hover:bg-ink hover:text-surface" variant="secondary">
            <AppLink href={`/app/rooms/${active.data.room.code}`}>回到房間<ArrowRight weight="bold" /></AppLink>
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left: 6-Cell Swiss Room Code OTP Input */}
        <section className="grid gap-5 border-2 border-line-strong bg-surface p-6 md:p-8 lg:col-span-5">
          <div className="grid gap-1 border-b border-line pb-4">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">01 // JOIN MATCH</span>
            <h2 className="text-2xl font-extrabold tracking-[-0.025em]">加入房間</h2>
          </div>
          <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); join(); }}>
            <div className="grid gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">6 位房間代碼</span>
              <OTPInput
                aria-label="房間代碼"
                className="flex items-center gap-2"
                inputMode="text"
                maxLength={6}
                onValueChange={(next) => setCode(next.toUpperCase())}
                pattern="alphanumeric"
                value={code}
              >
                <OTPInputGroup className="flex flex-1 gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <OTPInputSlot className={slotClass} index={index} key={index} />
                  ))}
                </OTPInputGroup>
                <OTPInputSeparator className="text-ink-faint">
                  <Minus aria-hidden className="size-4" weight="bold" />
                </OTPInputSeparator>
                <OTPInputGroup className="flex flex-1 gap-1.5">
                  {[3, 4, 5].map((index) => (
                    <OTPInputSlot className={slotClass} index={index} key={index} />
                  ))}
                </OTPInputGroup>
              </OTPInput>
            </div>
            <Button className="h-12 w-full justify-between px-5" disabled={normalized.length !== 6} size="lg" type="submit" variant="primary">
              <span>進入對戰房間</span>
              <ArrowRight weight="bold" />
            </Button>
          </form>
        </section>

        <div className="lg:col-span-7">
          {account ? <HostForm name={account.name} /> : null}
        </div>
      </div>
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
  const tasks = useMemo(() => (content.data ? availableTasks([content.data]).filter((task) => task !== "custom") : []), [content.data]);
  const [task, setTask] = useState<Exclude<PracticeTask, "custom"> | "">("");
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
      const { code } = await api<{ code: string }>("/rooms", {
        method: "POST",
        json: {
          name: name.trim() || defaultName,
          title: `${set.name} · ${TASK_LABELS[picked]}`.slice(0, 120),
          ...(seconds === "auto" ? {} : { seconds: Number(seconds) }),
          questions,
        },
      });
      navigate(`/app/rooms/${code}`);
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };

  return (
    <section className="grid gap-6 border border-line border-t-2 border-t-line-strong bg-surface p-6 md:p-8">
      <div className="grid gap-1 border-b border-line pb-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">02 // CREATE ROOM</span>
        <h2 className="text-2xl font-extrabold tracking-[-0.025em]">開設對戰房間</h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="你的暱稱">
          {({ id }) => <Input id={id} maxLength={40} onChange={(event) => setName(event.target.value)} value={name} />}
        </Field>
        {sets.length ? <LabeledSelect label="單字集" onChange={setSetId} options={sets.map((entry) => ({ value: entry.id, label: entry.name }))} value={chosen} /> : null}
      </div>

      {tasks.length ? (
        <LabeledSelect label="題型" onChange={(value) => setTask(value as Exclude<PracticeTask, "custom">)} options={tasks.map((value) => ({ value, label: TASK_LABELS[value] }))} value={picked ?? ""} />
      ) : <p className="font-mono text-xs text-ink-faint">正在讀取單字集…</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="grid gap-2">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">題數</h3>
          <Segmented label="題數" onChange={setAmount} options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))} value={amount} />
        </section>
        <section className="grid gap-2">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">每題秒數</h3>
          <Segmented label="每題秒數" onChange={setSeconds} options={SECONDS.map((value) => ({ value, label: value === "auto" ? "依題型" : `${value} 秒` }))} value={seconds} />
        </section>
      </div>

      <div className="border-t border-line pt-4">
        <Button className="h-12 px-6" disabled={!picked || !content.data} onClick={() => void host()} size="lg" status={status} variant="primary">
          <Sword weight="fill" />開房間
        </Button>
      </div>
    </section>
  );
}
