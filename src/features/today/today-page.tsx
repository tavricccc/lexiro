import { useMemo } from "react";
import { ArrowRight, CaretDown, Fire, Play, Star, Target } from "@phosphor-icons/react";
import { calendarDay, DAILY_GOALS, streak, type DailyGoal } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, EmptyState, Menu, SectionTitle, cn } from "design-kit";
import { toast } from "sonner";
import { errorMessage } from "@/data/api";
import { setGoal, usePendingAnswers, useLearning } from "@/data/learning";
import { useLibrary } from "@/data/queries";
import { loadRound } from "@/data/round-store";
import { orderedSets } from "@/features/library/library-page";
import { useStarredWords } from "@/features/library/starred-page";
import { Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";

function greeting(hour: number) {
  return hour < 5 ? "夜深了" : hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
}

const tileClass = "flex min-h-32 flex-col justify-between gap-3 rounded-[1.625rem] bg-surface p-4 outline-none transition-[background-color,box-shadow,scale] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-solid hover:shadow-panel active:scale-[var(--motion-card-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

export default function TodayPage() {
  const { learning } = useLearning();
  const library = useLibrary();
  const pending = usePendingAnswers();
  const starred = useStarredWords();
  const saved = useMemo(loadRound, []);
  const today = calendarDay(new Date());
  const done = learning.days[today]?.answered ?? 0;
  const left = Math.max(0, learning.goal - done);
  const days = streak(learning.days, today);
  const recent = orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, starred.count ? 3 : 4);
  const changeGoal = (goal: DailyGoal) => setGoal(goal).catch((error) => toast.error(errorMessage(error)));
  return (
    <Page documentTitle="今天" title={greeting(new Date().getHours())}>
      <section aria-label="今日目標" className="content-in grid gap-4 rounded-[2rem] bg-ink p-5 text-canvas">
        <div className="flex items-center justify-between gap-3 text-sm text-canvas/65">
          <Menu
            align="start"
            items={DAILY_GOALS.map((goal) => ({ key: String(goal), icon: Target, label: `每天 ${goal} 題`, onSelect: () => void changeGoal(goal) }))}
            title="每日目標"
            trigger={<button className="-mx-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 outline-none transition-[color,scale] duration-[var(--motion-control)] hover:text-canvas active:scale-[var(--motion-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" type="button">今日目標 <span className="font-latin">{learning.goal}</span> 題<CaretDown className="size-3.5" weight="bold" /></button>}
          />
          {days ? <span className="flex items-center gap-1"><Fire className="text-highlight" weight="fill" />連續 <span className="font-latin">{days}</span> 天</span> : null}
        </div>
        <p className="font-latin text-7xl font-bold leading-none tracking-[-0.04em]"><AnimatedNumber value={done} /><span className="text-3xl text-canvas/45"> / {learning.goal}</span></p>
        <div aria-hidden className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${learning.goal}, minmax(0, 1fr))` }}>
          {Array.from({ length: learning.goal }, (_, index) => <i className={cn("h-3.5 rounded-[0.3rem] transition-colors", index < done ? "bg-canvas" : "bg-canvas/14")} key={index} />)}
        </div>
        {saved ? (
          <Button asChild className="bg-canvas text-ink hover:bg-canvas/90" size="lg">
            <AppLink href="/app/practice/run"><Play weight="fill" />繼續上次 <span className="font-latin">{saved.index + 1}/{saved.items.length}</span></AppLink>
          </Button>
        ) : (
          <Button asChild className="bg-canvas text-ink hover:bg-canvas/90" size="lg">
            <AppLink href="/app/practice"><Play weight="fill" />{left ? <>再練 <span className="font-latin">{left}</span> 題</> : "多練幾題"}</AppLink>
          </Button>
        )}
        {pending ? <p className="text-[0.8125rem] text-canvas/60">有 {pending} 筆作答還沒上傳，連線後會自動送出。</p> : null}
      </section>
      <section className="grid gap-3">
        <SectionTitle action={<Button asChild size="sm" variant="ghost"><AppLink href="/app/practice">自選練習<ArrowRight weight="bold" /></AppLink></Button>}>單字集</SectionTitle>
        {library.data && !recent.length ? (
          <EmptyState action={<Button asChild variant="primary"><AppLink href="/app/sets/new">建立第一個單字集</AppLink></Button>} description="加入單字後就能開始練習。" title="還沒有單字" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recent.map((set) => (
              <AppLink className={tileClass} href={`/app/practice?set=${set.id}`} key={set.id}>
                <SetIcon className="size-9 rounded-[0.75rem] [&_svg]:size-5" icon={set.icon} />
                <span className="min-w-0">
                  <span className="line-clamp-2 font-semibold leading-snug">{set.name}</span>
                  <span className="text-[0.8125rem] text-ink-muted"><span className="font-latin">{set.wordCount}</span> 字</span>
                </span>
              </AppLink>
            ))}
            {starred.count ? (
              <AppLink className={tileClass} href="/app/starred">
                <span aria-hidden className="grid size-9 place-items-center rounded-[0.75rem] bg-highlight/15 text-highlight"><Star className="size-5" weight="fill" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">標星單字</span>
                  <span className="text-[0.8125rem] text-ink-muted"><span className="font-latin">{starred.count}</span> 字 · {starred.groups.length} 個單字集</span>
                </span>
              </AppLink>
            ) : null}
          </div>
        )}
      </section>
    </Page>
  );
}
