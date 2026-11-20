import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { Check, Play } from "@phosphor-icons/react";
import type { PracticeTask, SetContent } from "@lexiro/contract";
import { AppLink, Button, EmptyState, ListGroup, Panel, Segmented, cn } from "design-kit";
import { api } from "@/data/api";
import { useLearning } from "@/data/learning";
import { keys, useLibrary, usePrefs } from "@/data/queries";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { TASK_HINTS, TASK_LABELS } from "@/domain/labels";
import { availableTasks, buildRound, type Focus } from "@/domain/practice";
import { newRound } from "@/domain/round";
import { orderedSets } from "@/features/library/library-page";
import { Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";

const AMOUNTS = ["10", "20", "30", "50"] as const;

export default function SetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const library = useLibrary();
  const prefs = usePrefs();
  const { learning } = useLearning();
  const [saved, setSaved] = useState(loadRound);
  const sets = orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0);
  // Opened from a set: practise that set; no second pick.
  const [fromSets] = useState(() => params.getAll("set"));
  const [chosen, setChosen] = useState<string[]>(fromSets);
  const back = fromSets.length === 1 ? { href: `/app/sets/${fromSets[0]}`, label: "回到單字集" } : { href: "/app", label: "回到今天" };
  const [tasks, setTasks] = useState<PracticeTask[]>(() => (params.getAll("task") as PracticeTask[]));
  const [focus, setFocus] = useState<Focus>("all");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState("");
  // With nothing chosen yet, the round draws from every set.
  const ids = chosen.length ? chosen : sets.map((set) => set.id);
  const contents = useQueries({
    queries: ids.map((id) => ({ queryKey: keys.set(id), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`) })),
  });
  const loaded = contents.every((query) => query.data);
  // useQueries hands back a new array every render; key the derived data on
  // what was fetched, or the effect below re-runs every render and never settles.
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => contents.flatMap((query) => (query.data ? [query.data] : [])), [stamp]);
  const available = useMemo(() => (loaded ? availableTasks(data) : []), [loaded, data]);
  useEffect(() => {
    if (!available.length) return;
    setTasks((current) => {
      const kept = current.filter((task) => available.includes(task));
      if (kept.length && kept.length === current.length) return current;
      return kept.length ? kept : [available[0]];
    });
  }, [available]);
  const size = amount || String(AMOUNTS.find((value) => Number(value) >= (prefs.data?.practiceSize ?? 20)) ?? "20");

  if (library.data && !sets.length)
    return (
      <Page back={{ href: "/app", label: "回到今天" }} title="練習">
        <EmptyState action={<Button asChild variant="primary"><AppLink href="/app/library">去加單字</AppLink></Button>} description="先在單字集裡加一些單字，就能開始練習。" title="還沒有可以練習的單字" />
      </Page>
    );
  const toggleSet = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const toggleTask = (task: PracticeTask) => setTasks((current) => (current.includes(task) ? (current.length > 1 ? current.filter((value) => value !== task) : current) : [...current, task]));
  const start = () => {
    const items = buildRound({ contents: data, tasks, amount: Number(size), focus, learning });
    if (!items.length) return setError(focus === "starred" ? "選的單字集裡沒有標星的單字。" : "這些題型在選的單字集裡沒有可以出的題目。");
    saveRound(newRound(items, ids));
    navigate("/app/practice/run");
  };
  return (
    <Page back={back} title="練習">
      {saved ? (
        <Panel className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">有一輪還沒做完</p>
            <p className="text-sm text-ink-muted">做到第 {Math.min(saved.index + 1, saved.items.length)} / {saved.items.length} 題</p>
          </div>
          <Button onClick={() => { clearRound(); setSaved(null); }} variant="ghost">捨棄</Button>
          <Button asChild variant="primary"><AppLink href="/app/practice/run">繼續</AppLink></Button>
        </Panel>
      ) : null}
      {fromSets.length ? (
        <ListGroup title="單字集">
          {sets.filter((set) => fromSets.includes(set.id)).map((set) => (
            <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5" key={set.id}>
              <SetIcon className="size-9 [&_svg]:size-5" hue={set.hue} icon={set.icon} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{set.name}</span>
                <span className="block text-[0.8125rem] text-ink-muted">{set.wordCount} 個單字{set.questionCount ? ` · ${set.questionCount} 題` : ""}</span>
              </span>
            </li>
          ))}
        </ListGroup>
      ) : <ListGroup footer={chosen.length ? undefined : "沒有選的話，會從所有單字集出題。"} title="單字集">
        {sets.map((set) => {
          const on = chosen.includes(set.id);
          return (
            <li key={set.id}>
              <button aria-pressed={on} className="flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left outline-none transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised" onClick={() => toggleSet(set.id)} type="button">
                <SetIcon className="size-9 [&_svg]:size-5" hue={set.hue} icon={set.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{set.name}</span>
                  <span className="block text-[0.8125rem] text-ink-muted">{set.wordCount} 個單字{set.questionCount ? ` · ${set.questionCount} 題` : ""}</span>
                </span>
                <span aria-hidden className={cn("grid size-7 place-items-center rounded-lg border-2 transition-[background-color,border-color,scale] duration-[var(--motion-control)] ease-[var(--ease-bounce)]", on ? "scale-110 border-contrast-edge bg-contrast text-on-contrast" : "border-line-strong")}>
                  {on ? <Check className="size-3.5" weight="bold" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ListGroup>}
      <section className="grid gap-2">
        <h2 className="px-1 text-sm font-extrabold text-ink-muted">題型</h2>
        {loaded ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((task) => {
              const on = tasks.includes(task);
              return (
                <button aria-pressed={on} className={cn("cursor-pointer rounded-2xl border-2 p-4 text-left outline-none transition-[background-color,border-color,translate,box-shadow] duration-[var(--motion-touch)] active:translate-y-1 active:shadow-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]", on ? "border-contrast bg-accent-soft shadow-[0_4px_0_var(--contrast-edge)]" : "border-line bg-surface shadow-[0_4px_0_var(--line-strong)] hover:bg-surface-hover")} key={task} onClick={() => toggleTask(task)} type="button">
                  <span className={cn("block font-extrabold", on && "text-accent-ink")}>{TASK_LABELS[task]}</span>
                  <span className="block text-[0.8125rem] text-ink-muted">{TASK_HINTS[task]}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="px-1 text-sm text-ink-faint">正在讀取單字集…</p>}
      </section>
      <section className="grid gap-2">
        <h2 className="px-1 text-sm font-extrabold text-ink-muted">出題方式</h2>
        <Segmented label="出題方式" onChange={setFocus} options={[{ value: "all", label: "隨機" }, { value: "weak", label: "不熟的優先" }, { value: "starred", label: "只練標星" }]} value={focus} />
      </section>
      <section className="grid gap-2">
        <h2 className="px-1 text-sm font-extrabold text-ink-muted">題數</h2>
        <Segmented label="題數" onChange={setAmount} options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))} value={size} />
      </section>
      {error ? <p className="message-in px-1 text-sm text-danger" role="alert">{error}</p> : null}
      <Button className="w-full md:w-auto md:justify-self-start md:min-w-56" disabled={!loaded || !tasks.length} onClick={start} size="lg" variant="primary"><Play weight="fill" />開始練習</Button>
    </Page>
  );
}
