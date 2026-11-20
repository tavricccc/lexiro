import { useMemo } from "react";
import { ArrowRight, Fire, Play, Plus } from "@phosphor-icons/react";
import { calendarDay, DAILY_GOALS, streak, type DailyGoal } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, Panel, SectionTitle, Segmented, cn } from "design-kit";
import { toast } from "sonner";
import { errorMessage } from "@/data/api";
import { setGoal, usePendingAnswers, useLearning } from "@/data/learning";
import { useLibrary } from "@/data/queries";
import { loadRound } from "@/data/round-store";
import { orderedSets } from "@/features/library/library-page";
import { Mascot } from "@/ui/mascot";
import { SetIcon } from "@/ui/set-icon";
import { useDocumentTitle } from "@/ui/title";

function greeting(hour: number) {
  return hour < 5 ? "夜深了" : hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
}

export default function TodayPage() {
  useDocumentTitle("今天");
  const { learning } = useLearning();
  const library = useLibrary();
  const pending = usePendingAnswers();
  const saved = useMemo(loadRound, []);
  const today = calendarDay(new Date());
  const done = learning.days[today]?.answered ?? 0;
  const days = streak(learning.days, today);
  const reached = done >= learning.goal;
  const hour = new Date().getHours();
  const recent = orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const changeGoal = (goal: DailyGoal) => setGoal(goal).catch((error) => toast.error(errorMessage(error)));
  return (
    <div className="grid gap-6">
      <header className="flex items-end gap-3">
        <Mascot className="size-20 shrink-0" mood={reached ? "cheer" : hour < 5 ? "sleepy" : "happy"} />
        <div className="relative mb-3 min-w-0 rounded-2xl rounded-bl-md border-2 border-line bg-surface px-4 py-2.5 shadow-[0_3px_0_var(--line-strong)]">
          <h1 className="text-xl font-extrabold">{greeting(hour)}！</h1>
          <p className="text-[0.9375rem] font-medium text-ink-muted">{reached ? "今天的目標達成了，想多練也可以。" : `今天還差 ${learning.goal - done} 題就達標。`}</p>
        </div>
      </header>

      <Panel className="grid gap-5">
        <div className="flex items-center gap-5">
          <GoalRing done={done} goal={learning.goal} />
          <div className="grid min-w-0 flex-1 gap-3">
            <div className={cn("flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold", days ? "bg-highlight text-on-highlight shadow-[0_3px_0_var(--highlight-edge)]" : "bg-surface-pressed text-ink-muted")}>
              <Fire className={cn("size-5", days && "wiggle")} weight="fill" />
              連續 <span className="font-latin">{days}</span> 天
            </div>
            <Segmented label="每日目標" onChange={(value) => void changeGoal(Number(value) as DailyGoal)} options={DAILY_GOALS.map((goal) => ({ label: `${goal} 題`, value: String(goal) }))} value={String(learning.goal)} />
          </div>
        </div>
        {pending ? <p className="text-[0.8125rem] font-medium text-ink-muted">有 {pending} 筆作答還沒上傳，連線後會自動送出。</p> : null}
        {saved ? (
          <Button asChild size="lg" variant="primary">
            <AppLink href="/app/practice/run"><Play weight="fill" />繼續上次的練習 <span className="font-latin opacity-80">{saved.index + 1}/{saved.items.length}</span></AppLink>
          </Button>
        ) : (
          <Button asChild size="lg" variant="primary"><AppLink href="/app/practice"><Play weight="fill" />開始練習</AppLink></Button>
        )}
      </Panel>

      <section className="grid gap-3">
        <SectionTitle action={recent.length ? <Button asChild size="sm" variant="ghost"><AppLink href="/app/library">全部<ArrowRight weight="bold" /></AppLink></Button> : null}>從單字集開始</SectionTitle>
        {library.data && !recent.length ? (
          <Panel className="grid justify-items-center gap-3 py-8 text-center">
            <p className="font-extrabold">還沒有單字</p>
            <p className="text-sm text-ink-muted">加入單字後就能開始練習。</p>
            <Button asChild variant="primary"><AppLink href="/app/sets/new"><Plus weight="bold" />建立第一個單字集</AppLink></Button>
          </Panel>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recent.map((set) => (
              <Panel asChild interactive key={set.id}>
                <AppLink aria-label={`練習 ${set.name}`} className="grid gap-3" href={`/app/practice?set=${set.id}`}>
                  <span className="flex items-start justify-between">
                    <SetIcon hue={set.hue} icon={set.icon} />
                    <Play aria-hidden className="size-5 text-ink-faint" weight="fill" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold">{set.name}</span>
                    <span className="text-[0.8125rem] font-medium text-ink-muted"><span className="font-latin">{set.wordCount}</span> 個單字</span>
                  </span>
                </AppLink>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const ratio = Math.min(1, done / goal);
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div aria-label={`今日進度 ${done} / ${goal} 題`} className="relative grid size-28 shrink-0 place-items-center" role="img">
      <svg aria-hidden className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="none" r={r} stroke="var(--surface-pressed)" strokeWidth="11" />
        <circle
          className="transition-[stroke-dashoffset] duration-[var(--motion-reveal)] ease-[var(--ease-bounce)]"
          cx="50" cy="50" fill="none" r={r}
          stroke={ratio >= 1 ? "var(--positive)" : "var(--contrast)"}
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} strokeLinecap="round" strokeWidth="11"
        />
      </svg>
      <span aria-hidden className="grid justify-items-center leading-none">
        <span className="font-latin text-3xl font-extrabold"><AnimatedNumber value={done} /></span>
        <span className="font-latin text-sm font-bold text-ink-faint">/ {goal}</span>
      </span>
    </div>
  );
}
