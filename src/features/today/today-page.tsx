import { useMemo } from "react";
import { ArrowRight, Fire, Play, Target } from "@phosphor-icons/react";
import { calendarDay, DAILY_GOALS, streak, type DailyGoal } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, EmptyState, Panel, ProgressBar, SectionTitle, Segmented } from "design-kit";
import { toast } from "sonner";
import { errorMessage } from "@/data/api";
import { setGoal, usePendingAnswers, useLearning } from "@/data/learning";
import { useLibrary } from "@/data/queries";
import { loadRound } from "@/data/round-store";
import { orderedSets } from "@/features/library/library-page";
import { Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";

function greeting(hour: number) {
  return hour < 5 ? "夜深了" : hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
}

export default function TodayPage() {
  const { learning } = useLearning();
  const library = useLibrary();
  const pending = usePendingAnswers();
  const saved = useMemo(loadRound, []);
  const today = calendarDay(new Date());
  const done = learning.days[today]?.answered ?? 0;
  const days = streak(learning.days, today);
  const recent = orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const changeGoal = (goal: DailyGoal) => setGoal(goal).catch((error) => toast.error(errorMessage(error)));
  return (
    <Page description={done >= learning.goal ? "今天的目標達成了，想多練也可以。" : `今天還差 ${learning.goal - done} 題就達標。`} documentTitle="今天" title={greeting(new Date().getHours())}>
      <Panel className="grid gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-muted">今日進度</p>
            <p className="font-latin text-5xl font-extrabold tracking-tight"><AnimatedNumber value={done} /><span className="text-2xl font-semibold text-ink-faint"> / {learning.goal}</span></p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold"><Fire className="text-highlight" weight="fill" />連續 <span className="font-latin">{days}</span> 天</div>
        </div>
        <ProgressBar label="今日目標進度" value={Math.min(1, done / learning.goal)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm text-ink-muted"><Target />每日目標</span>
          <Segmented label="每日目標" onChange={(value) => void changeGoal(Number(value) as DailyGoal)} options={DAILY_GOALS.map((goal) => ({ label: `${goal} 題`, value: String(goal) }))} value={String(learning.goal)} />
        </div>
        {pending ? <p className="text-[0.8125rem] text-ink-muted">有 {pending} 筆作答還沒上傳，連線後會自動送出。</p> : null}
      </Panel>
      {saved ? (
        <Panel asChild interactive>
          <AppLink className="flex items-center gap-3" href="/app/practice/run">
            <Play className="size-5 text-contrast" weight="fill" />
            <span className="flex-1"><span className="block font-semibold">繼續上次的練習</span><span className="text-sm text-ink-muted">第 {saved.index + 1} / {saved.items.length} 題</span></span>
            <ArrowRight weight="bold" />
          </AppLink>
        </Panel>
      ) : null}
      <section className="grid gap-3">
        <SectionTitle action={<Button asChild size="sm"><AppLink href="/app/library">全部單字集</AppLink></Button>}>從單字集開始</SectionTitle>
        {library.data && !recent.length ? (
          <EmptyState action={<Button asChild variant="primary"><AppLink href="/app/sets/new">建立第一個單字集</AppLink></Button>} description="加入單字後就能開始練習。" title="還沒有單字" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recent.map((set) => (
              <Panel className="flex items-center gap-3" key={set.id}>
                <SetIcon hue={set.hue} icon={set.icon} />
                <AppLink className="min-w-0 flex-1" href={`/app/sets/${set.id}`}><span className="block truncate font-semibold">{set.name}</span><span className="text-sm text-ink-muted">{set.wordCount} 個單字</span></AppLink>
                <Button aria-label={`練習 ${set.name}`} asChild size="icon-sm" variant="primary"><AppLink href={`/app/practice?set=${set.id}`}><Play weight="fill" /></AppLink></Button>
              </Panel>
            ))}
          </div>
        )}
        <Button asChild size="lg" variant="primary"><AppLink href="/app/practice"><Play weight="fill" />開始練習</AppLink></Button>
      </section>
    </Page>
  );
}
