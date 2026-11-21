import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Check, Play } from "@phosphor-icons/react";
import type { PracticeTask, SetContent } from "@lexiro/contract";
import { AppLink, Button, EmptyState, Segmented, cn } from "design-kit";
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
  const [fromSets] = useState(() => params.getAll("set"));
  const [chosen, setChosen] = useState<string[]>(fromSets);
  const back = fromSets.length === 1 ? { href: `/app/sets/${fromSets[0]}`, label: "回到單字集" } : { href: "/app", label: "回到今天" };
  const [tasks, setTasks] = useState<PracticeTask[]>(() => (params.getAll("task") as PracticeTask[]));
  const [focus, setFocus] = useState<Focus>("all");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState("");
  const ids = chosen.length ? chosen : sets.map((set) => set.id);
  const contents = useQueries({
    queries: ids.map((id) => ({ queryKey: keys.set(id), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`) })),
  });
  const loaded = contents.every((query) => query.data);
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
      <Page back={{ href: "/app", label: "回到今天" }} kicker="PRACTICE // CONFIG" title="練習">
        <EmptyState
          action={<Button asChild variant="primary"><AppLink href="/app/library">去加單字</AppLink></Button>}
          description="先在單字集裡加一些單字，就能開始練習。"
          title="還沒有可以練習的單字"
        />
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
    <Page back={back} kicker="PRACTICE // SESSION CONFIGURATOR" title="練習">
      {saved ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-line-strong bg-ink p-5 text-surface">
          <div className="min-w-0">
            <span className="block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-surface/70">INCOMPLETE ROUND</span>
            <p className="mt-0.5 font-bold">
              有一輪還沒做完 — 第 {Math.min(saved.index + 1, saved.items.length)} / {saved.items.length} 題
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="border-surface/40 bg-transparent text-surface hover:bg-surface/15 hover:text-surface" onClick={() => { clearRound(); setSaved(null); }} size="sm" variant="secondary">捨棄</Button>
            <Button asChild size="sm" variant="primary"><AppLink href="/app/practice/run">繼續<ArrowRight weight="bold" /></AppLink></Button>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Left: Set Scope */}
        <section className="grid gap-3 lg:col-span-5">
          <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-2">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">01 // 單字集範圍</h2>
            <span className="font-mono text-xs font-semibold text-contrast">
              {fromSets.length ? `${fromSets.length} SET` : chosen.length ? `已選 ${chosen.length}` : `全部 (${sets.length})`}
            </span>
          </div>

          {fromSets.length ? (
            <ul className="divide-y divide-line border border-line bg-surface">
              {sets.filter((set) => fromSets.includes(set.id)).map((set) => (
                <li className="flex min-h-14 items-center gap-3.5 px-4 py-3" key={set.id}>
                  <SetIcon className="size-9 [&_svg]:size-4" hue={set.hue} icon={set.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{set.name}</span>
                    <span className="block font-mono text-xs text-ink-muted">{set.wordCount} 字{set.questionCount ? ` · ${set.questionCount} 題` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <ul className="divide-y divide-line border border-line bg-surface">
                {sets.map((set) => {
                  const on = chosen.includes(set.id);
                  return (
                    <li key={set.id}>
                      <button
                        aria-pressed={on}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast",
                          on ? "bg-accent-soft" : "hover:bg-surface-raised",
                        )}
                        onClick={() => toggleSet(set.id)}
                        type="button"
                      >
                        <SetIcon className="size-9 [&_svg]:size-4" hue={set.hue} icon={set.icon} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{set.name}</span>
                          <span className="block font-mono text-xs text-ink-muted">{set.wordCount} 字{set.questionCount ? ` · ${set.questionCount} 題` : ""}</span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-5 shrink-0 place-items-center border-2 transition-colors",
                            on ? "border-contrast bg-contrast text-on-contrast" : "border-line-strong/40 bg-surface",
                          )}
                        >
                          {on ? <Check className="size-3.5" weight="bold" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!chosen.length ? <p className="font-mono text-xs text-ink-faint">未勾選時，預設從所有單字集出題。</p> : null}
            </>
          )}
        </section>

        {/* Right: Configuration Console */}
        <section className="grid gap-6 border-2 border-line-strong bg-surface p-6 md:p-7 lg:sticky lg:top-8 lg:col-span-7">
          <div className="grid gap-3">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">02 // 題型</h2>
              <span className="font-mono text-xs text-ink-muted">{tasks.length} SELECTED</span>
            </div>
            {loaded ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {available.map((task, idx) => {
                  const on = tasks.includes(task);
                  return (
                    <button
                      aria-pressed={on}
                      className={cn(
                        "group relative grid gap-1 border p-4 text-left outline-none transition-colors duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-contrast",
                        on
                          ? "border-contrast bg-contrast text-on-contrast"
                          : "border-line bg-surface hover:border-line-strong hover:bg-surface-raised",
                      )}
                      key={task}
                      onClick={() => toggleTask(task)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-mono text-[0.6875rem] font-bold", on ? "text-on-contrast/80" : "text-ink-faint")}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {on ? <Check className="size-4" weight="bold" /> : null}
                      </div>
                      <span className="text-base font-bold tracking-[-0.015em]">{TASK_LABELS[task]}</span>
                      <span className={cn("text-xs leading-relaxed", on ? "text-on-contrast/85" : "text-ink-muted")}>{TASK_HINTS[task]}</span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="font-mono text-xs text-ink-faint">正在讀取單字集…</p>}
          </div>

          <div className="grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
            <div className="grid content-start gap-2.5">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">03 // 出題方式</h2>
              <Segmented
                label="出題方式"
                onChange={setFocus}
                options={[{ value: "all", label: "隨機" }, { value: "weak", label: "不熟優先" }, { value: "starred", label: "只練標星" }]}
                value={focus}
              />
            </div>
            <div className="grid content-start gap-2.5">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">04 // 題數</h2>
              <Segmented
                label="題數"
                onChange={setAmount}
                options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))}
                value={size}
              />
            </div>
          </div>

          {error ? <p className="message-in border-l-2 border-danger pl-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}

          <div className="border-t-2 border-line-strong pt-5">
            <Button
              className="h-14 w-full justify-between px-6 text-base"
              disabled={!loaded || !tasks.length}
              onClick={start}
              size="lg"
              variant="primary"
            >
              <span className="flex items-center gap-2.5"><Play weight="fill" />開始練習</span>
              <span className="font-mono text-xs uppercase tracking-[0.1em] opacity-85">{size} QUESTIONS →</span>
            </Button>
          </div>
        </section>
      </div>
    </Page>
  );
}
