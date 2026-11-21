import { useMemo } from "react";
import { ArrowRight, ArrowUpRight, Fire, Play, Target } from "@phosphor-icons/react";
import { calendarDay, DAILY_GOALS, streak, type DailyGoal } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, EmptyState, ProgressBar, Segmented, cn } from "design-kit";
import { toast } from "sonner";
import { errorMessage } from "@/data/api";
import { setGoal, usePendingAnswers, useLearning } from "@/data/learning";
import { useLibrary } from "@/data/queries";
import { loadRound } from "@/data/round-store";
import { orderedSets } from "@/features/library/library-page";
import { Page } from "@/ui/page";
import { HUE_BAR, SetIcon } from "@/ui/set-icon";

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
  const ratio = Math.min(1, done / learning.goal);
  const percent = Math.round(ratio * 100);
  const sets = library.data?.sets ?? [];
  const totalWords = sets.reduce((sum, set) => sum + set.wordCount, 0);
  const recent = orderedSets(sets).filter((set) => set.wordCount > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const changeGoal = (goal: DailyGoal) => setGoal(goal).catch((error) => toast.error(errorMessage(error)));

  return (
    <Page
      description={done >= learning.goal ? "今日目標已達成，可繼續加練。" : `距離今日目標還差 ${learning.goal - done} 題。`}
      documentTitle="今天"
      kicker={`01 // TODAY — ${today}`}
      title={greeting(new Date().getHours())}
    >
      {/* Asymmetric Swiss 12-column briefing grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Monumental Daily Counter */}
        <section className="flex flex-col justify-between border-2 border-line-strong bg-surface p-6 md:p-8 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
            <div className="grid gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">DAILY PROGRESS</span>
              <p className="flex items-baseline gap-2 font-latin text-[clamp(4rem,10vw,6.75rem)] font-black leading-[0.86] tracking-[-0.06em] tabular-nums text-ink">
                <AnimatedNumber value={done} />
                <span className="text-2xl font-bold tracking-[-0.03em] text-ink-faint md:text-4xl">/ {learning.goal}</span>
              </p>
            </div>
            <div className={cn(
              "inline-flex items-center gap-2 border px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-[0.06em]",
              days > 0 ? "border-highlight bg-highlight/10 text-highlight" : "border-line bg-surface-raised text-ink-muted",
            )}>
              <Fire className="size-4" weight="fill" />
              <span>連續 <span className="tabular-nums">{days}</span> 天</span>
            </div>
          </div>

          <div className="grid gap-3 py-6">
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-ink-muted">COMPLETION</span>
              <span className={cn("font-bold tabular-nums", percent >= 100 ? "text-positive" : "text-contrast")}>{percent}%</span>
            </div>
            <ProgressBar className="h-3" label="今日目標進度" value={ratio} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <Target className="size-4 text-ink" weight="bold" />
              每日目標
            </span>
            <Segmented
              label="每日目標"
              onChange={(value) => void changeGoal(Number(value) as DailyGoal)}
              options={DAILY_GOALS.map((goal) => ({ label: `${goal} 題`, value: String(goal) }))}
              value={String(learning.goal)}
            />
          </div>

          {pending ? (
            <p className="mt-4 border-l-2 border-caution pl-3 font-mono text-xs text-caution">
              有 {pending} 筆作答尚未上傳，連線後自動同步。
            </p>
          ) : null}
        </section>

        {/* Right: Action Launchpad */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <AppLink
            className="group flex flex-1 flex-col justify-between border-2 border-contrast bg-contrast p-6 text-on-contrast outline-none transition-colors duration-[var(--motion-control)] hover:border-ink hover:bg-ink focus-visible:ring-2 focus-visible:ring-contrast focus-visible:ring-offset-2 md:p-8"
            href="/app/practice"
          >
            <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase tracking-[0.12em] text-on-contrast/80">
              <span>LAUNCH // DRILL</span>
              <ArrowUpRight className="size-6 transition-transform duration-[var(--motion-control)] group-hover:translate-x-1 group-hover:-translate-y-1" weight="bold" />
            </div>
            <div className="mt-10 grid gap-1">
              <span className="text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">開始練習</span>
              <span className="font-mono text-xs text-on-contrast/80">自訂範圍、題型與題數</span>
            </div>
          </AppLink>

          {saved ? (
            <AppLink
              className="group flex items-center justify-between gap-4 border-2 border-line-strong bg-surface p-5 outline-none transition-colors hover:bg-ink hover:text-surface focus-visible:ring-2 focus-visible:ring-contrast"
              href="/app/practice/run"
            >
              <div className="min-w-0 grid gap-0.5">
                <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-contrast group-hover:text-surface/75">RESUME SESSION</span>
                <span className="truncate text-base font-bold">繼續上次的練習</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 font-mono text-sm font-bold tabular-nums">
                <span>{String(saved.index + 1).padStart(2, "0")}/{String(saved.items.length).padStart(2, "0")}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" weight="bold" />
              </div>
            </AppLink>
          ) : null}

          <div className="grid grid-cols-2 divide-x divide-line border border-line bg-surface">
            <div className="p-4">
              <span className="block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">SETS</span>
              <span className="mt-1 block font-latin text-2xl font-extrabold tabular-nums">{sets.length}</span>
            </div>
            <div className="p-4">
              <span className="block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">WORDS</span>
              <span className="mt-1 block font-latin text-2xl font-extrabold tabular-nums">{totalWords}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Recent Sets Horizontal Index */}
      <section className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-line-strong pb-2.5">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink">RECENT SETS // 從單字集開始</h2>
          <AppLink className="inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-contrast hover:underline" href="/app/library">
            全部單字集
            <ArrowRight className="size-3.5" weight="bold" />
          </AppLink>
        </div>

        {library.data && !recent.length ? (
          <EmptyState
            action={<Button asChild variant="primary"><AppLink href="/app/sets/new">建立第一個單字集</AppLink></Button>}
            description="加入單字後就能開始練習。"
            title="還沒有單字"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((set, index) => (
              <div className="group flex flex-col border border-line bg-surface transition-colors hover:border-line-strong" key={set.id}>
                <div className={cn("h-1.5 w-full", HUE_BAR[set.hue] ?? "bg-contrast")} />
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                    <SetIcon className="size-8 [&_svg]:size-4" hue={set.hue} icon={set.icon} />
                  </div>
                  <AppLink className="min-w-0 flex-1 outline-none" href={`/app/sets/${set.id}`}>
                    <span className="block truncate text-lg font-bold tracking-[-0.02em] text-ink group-hover:text-contrast">{set.name}</span>
                    <span className="mt-1 block font-mono text-xs text-ink-muted">{set.wordCount} 個單字</span>
                  </AppLink>
                </div>
                <div className="flex items-center justify-between border-t border-line bg-surface-raised/60 px-4 py-2.5">
                  <AppLink className="font-mono text-xs font-semibold text-ink-muted hover:text-ink" href={`/app/sets/${set.id}`}>查看字表</AppLink>
                  <Button aria-label={`練習 ${set.name}`} asChild size="sm" variant="primary">
                    <AppLink href={`/app/practice?set=${set.id}`}><Play className="size-3.5" weight="fill" />練習</AppLink>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
