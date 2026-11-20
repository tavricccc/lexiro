import { useMemo } from "react";
import { calendarDay, PRACTICE_TASKS, shiftDay, streak, type Tally } from "@lexiro/contract";
import { Crown, Fire, Lightning, Target } from "@phosphor-icons/react";
import { AnimatedNumber, EmptyState, AppLink, Button, Panel, SectionTitle, cn } from "design-kit";
import { useLearning } from "@/data/learning";
import { FAMILIARITY_LABELS, TASK_LABELS } from "@/domain/labels";
import { Page } from "@/ui/page";

const WEEKS = 15;
const LEVEL_TONE = ["bg-ink-faint/40", "bg-hue-sky", "bg-contrast", "bg-positive"];
const percent = (tally?: Tally) => (tally?.answered ? Math.round((tally.correct / tally.answered) * 100) : null);

export default function ProgressPage() {
  const { learning } = useLearning();
  const today = calendarDay(new Date());
  const stats = useMemo(() => {
    const days = Object.values(learning.days);
    const total = days.reduce((sum, day) => ({ answered: sum.answered + day.answered, correct: sum.correct + day.correct }), { answered: 0, correct: 0 });
    const levels = [0, 0, 0, 0];
    for (const sense of Object.values(learning.senses)) levels[sense.level] += 1;
    let best = 0, run = 0;
    for (const day of Object.keys(learning.days).sort()) {
      run = learning.days[shiftDay(day, -1)]?.answered ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return { total, levels, best, practised: Object.keys(learning.senses).length };
  }, [learning]);
  // A grid of the last WEEKS weeks, a column per week, Sunday on top.
  const grid = useMemo(() => {
    const start = shiftDay(today, -(WEEKS * 7 - 1) - new Date(`${today}T12:00:00Z`).getUTCDay() + 6);
    return Array.from({ length: WEEKS }, (_, week) => Array.from({ length: 7 }, (_, weekday) => shiftDay(start, week * 7 + weekday)));
  }, [today]);
  const peak = Math.max(learning.goal, ...Object.values(learning.days).map((day) => day.answered));
  if (!stats.total.answered)
    return (
      <Page title="進度">
        <EmptyState action={<Button asChild variant="primary"><AppLink href="/app/practice">開始練習</AppLink></Button>} description="練習過後，這裡會出現你的連續天數、答對率和熟悉度。" title="還沒有練習紀錄" />
      </Page>
    );
  return (
    <Page title="進度">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([
          ["連續天數", streak(learning.days, today), "天", Fire, "bg-highlight text-on-highlight"],
          ["最長連續", stats.best, "天", Crown, "bg-hue-rose text-white"],
          ["總作答", stats.total.answered, "題", Lightning, "bg-contrast text-on-contrast"],
          ["答對率", percent(stats.total) ?? 0, "%", Target, "bg-positive text-on-positive"],
        ] as const).map(([label, value, unit, Icon, tone]) => (
          <Panel className="grid gap-2" key={label}>
            <span aria-hidden className={cn("grid size-9 place-items-center rounded-xl", tone)}><Icon className="size-5" weight="fill" /></span>
            <p className="font-latin text-3xl font-extrabold tracking-tight"><AnimatedNumber value={value} /><span className="ml-0.5 text-base font-bold text-ink-faint">{unit}</span></p>
            <p className="text-sm font-bold text-ink-muted">{label}</p>
          </Panel>
        ))}
      </div>
      <Panel className="grid gap-3">
        <SectionTitle>最近 {WEEKS} 週</SectionTitle>
        <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`最近 ${WEEKS} 週每天的作答量`}>
          {grid.map((week, index) => (
            <div className="grid shrink-0 gap-1" key={index}>
              {week.map((day) => {
                const answered = learning.days[day]?.answered ?? 0;
                const level = day > today ? -1 : answered === 0 ? 0 : answered >= learning.goal ? 4 : Math.ceil((answered / peak) * 3);
                return (
                  <span
                    className={cn("size-4 rounded-[5px] md:size-5", level < 0 ? "bg-transparent" : level === 0 ? "bg-surface-pressed" : level === 4 ? "bg-positive" : "bg-contrast", day === today && "ring-2 ring-highlight ring-offset-1 ring-offset-surface")}
                    key={day}
                    style={level > 0 && level < 4 ? { opacity: [0, 0.35, 0.6, 0.85][level] } : undefined}
                    title={`${day}：${answered} 題`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-[0.8125rem] font-medium text-ink-muted">紫色越深代表練得越多，綠色代表達成每日目標（{learning.goal} 題）。</p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="grid gap-3">
          <SectionTitle>熟悉度</SectionTitle>
          <p className="text-sm text-ink-muted">練習過 <span className="font-latin font-semibold text-ink">{stats.practised}</span> 個字義</p>
          <div className="flex h-4 gap-1 overflow-hidden rounded-full">
            {stats.levels.map((count, level) => count ? <span className={cn("bar-in rounded-full", LEVEL_TONE[level])} key={level} style={{ width: `${(count / stats.practised) * 100}%` }} /> : null)}
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {stats.levels.map((count, level) => (
              <li className="flex items-center gap-2 font-semibold" key={level}><span className={cn("size-3 rounded-full", LEVEL_TONE[level])} />{FAMILIARITY_LABELS[level]}<span className="ml-auto font-latin text-ink-muted">{count}</span></li>
            ))}
          </ul>
        </Panel>
        <Panel className="grid gap-3">
          <SectionTitle>各題型答對率</SectionTitle>
          <ul className="grid gap-2.5">
            {PRACTICE_TASKS.filter((task) => learning.tasks[task]?.answered).map((task) => {
              const rate = percent(learning.tasks[task])!;
              return (
                <li className="grid gap-1" key={task}>
                  <div className="flex text-sm font-semibold"><span>{TASK_LABELS[task]}</span><span className="ml-auto font-latin text-ink-muted">{rate}% · {learning.tasks[task].answered} 題</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-pressed"><div className={cn("bar-in h-full rounded-full", rate >= 80 ? "bg-positive" : rate >= 50 ? "bg-highlight" : "bg-danger")} style={{ width: `${rate}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
