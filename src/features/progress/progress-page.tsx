import { useMemo } from "react";
import { calendarDay, PRACTICE_TASKS, shiftDay, streak, type Tally } from "@lexiro/contract";
import { AnimatedNumber, EmptyState, AppLink, Button, Panel, SectionTitle, cn } from "design-kit";
import { useLearning } from "@/data/learning";
import { FAMILIARITY_LABELS, TASK_LABELS } from "@/domain/labels";
import { Page } from "@/ui/page";

const WEEKS = 15;
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

  const grid = useMemo(() => {
    const start = shiftDay(today, -(WEEKS * 7 - 1) - new Date(`${today}T12:00:00Z`).getUTCDay() + 6);
    return Array.from({ length: WEEKS }, (_, week) => Array.from({ length: 7 }, (_, weekday) => shiftDay(start, week * 7 + weekday)));
  }, [today]);
  const peak = Math.max(learning.goal, ...Object.values(learning.days).map((day) => day.answered));

  if (!stats.total.answered)
    return (
      <Page kicker="03 // TELEMETRY" title="進度">
        <EmptyState
          action={<Button asChild variant="primary"><AppLink href="/app/practice">開始練習</AppLink></Button>}
          description="練習過後，這裡會出現你的連續天數、答對率和熟悉度。"
          title="還沒有練習紀錄"
        />
      </Page>
    );

  const currentStreak = streak(learning.days, today);
  const overallRate = percent(stats.total) ?? 0;

  return (
    <Page kicker="03 // TELEMETRY & RETENTION" title="進度">
      {/* 4-column Swiss KPI banner */}
      <div className="grid grid-cols-2 divide-y divide-line border-2 border-line-strong bg-surface md:grid-cols-4 md:divide-x md:divide-y-0">
        {[
          { idx: "01", label: "連續天數", value: currentStreak, unit: "天", tone: currentStreak > 0 ? "text-highlight" : "text-ink" },
          { idx: "02", label: "最長連續", value: stats.best, unit: "天", tone: "text-ink" },
          { idx: "03", label: "總作答", value: stats.total.answered, unit: "題", tone: "text-ink" },
          { idx: "04", label: "答對率", value: overallRate, unit: "%", tone: "text-contrast" },
        ].map((metric, i) => (
          <div className={cn("grid gap-3 p-5 md:p-6", i % 2 === 1 && "border-l border-line md:border-l-0")} key={metric.idx}>
            <div className="flex items-center justify-between font-mono text-xs text-ink-muted">
              <span>{metric.label}</span>
              <span className="text-ink-faint">{metric.idx}</span>
            </div>
            <p className={cn("font-latin text-4xl font-black leading-none tracking-[-0.04em] tabular-nums md:text-5xl", metric.tone)}>
              <AnimatedNumber value={metric.value} />
              <span className="ml-1 text-base font-bold text-ink-faint">{metric.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 15-Week Architectural Activity Matrix */}
      <Panel className="grid gap-5 border-t-2 border-t-line-strong">
        <SectionTitle
          action={
            <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-faint">
              <span>0</span>
              {[0, 0.3, 0.55, 0.8, 1].map((opacity, i) => (
                <span
                  className={cn("size-3 border border-line-strong/15", i === 0 ? "bg-surface-raised" : "bg-contrast")}
                  key={i}
                  style={i > 0 ? { opacity } : undefined}
                />
              ))}
              <span>{learning.goal}+</span>
            </div>
          }
        >
          ACTIVITY MATRIX // 最近 {WEEKS} 週
        </SectionTitle>

        <div className="flex gap-1.5 overflow-x-auto pb-1" role="img" aria-label={`最近 ${WEEKS} 週每天的作答量`}>
          {grid.map((week, index) => (
            <div className="grid shrink-0 gap-1.5" key={index}>
              {week.map((day) => {
                const answered = learning.days[day]?.answered ?? 0;
                const level = day > today ? -1 : answered === 0 ? 0 : answered >= learning.goal ? 4 : Math.ceil((answered / peak) * 3);
                return (
                  <span
                    className={cn(
                      "size-5 rounded-none md:size-6",
                      level < 0 ? "bg-transparent" : level === 0 ? "border border-line bg-surface-raised" : "bg-contrast",
                      day === today && "outline-2 outline-offset-1 outline-highlight",
                    )}
                    key={day}
                    style={level > 0 ? { opacity: [0, 0.3, 0.55, 0.8, 1][level] } : undefined}
                    title={`${day}：${answered} 題`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-ink-muted">
          每格一日，滿色代表達標（{learning.goal} 題）；紅框標記今日。
        </p>
      </Panel>

      {/* Bottom Analytical Split */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="grid content-start gap-5 border-t-2 border-t-line-strong lg:col-span-5">
          <SectionTitle action={<span className="font-mono text-xs font-bold tabular-nums text-ink">{stats.practised} SENSES</span>}>
            熟悉度分佈
          </SectionTitle>
          <div className="flex h-6 overflow-hidden border border-line-strong bg-surface-raised">
            {stats.levels.map((count, level) =>
              count ? (
                <span
                  className="bg-contrast transition-all"
                  key={level}
                  style={{ width: `${(count / stats.practised) * 100}%`, opacity: 0.22 + level * 0.26 }}
                />
              ) : null,
            )}
          </div>
          <ul className="divide-y divide-line border border-line">
            {stats.levels.map((count, level) => {
              const share = stats.practised ? Math.round((count / stats.practised) * 100) : 0;
              return (
                <li className="flex items-center gap-3 px-3.5 py-2.5 text-sm" key={level}>
                  <span className="size-3.5 shrink-0 bg-contrast" style={{ opacity: 0.22 + level * 0.26 }} />
                  <span className="font-semibold">{FAMILIARITY_LABELS[level]}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-ink-muted">{count} · {share}%</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="grid content-start gap-5 border-t-2 border-t-line-strong lg:col-span-7">
          <SectionTitle>各題型答對率</SectionTitle>
          <ul className="grid gap-4">
            {PRACTICE_TASKS.filter((task) => learning.tasks[task]?.answered).map((task, idx) => {
              const rate = percent(learning.tasks[task])!;
              return (
                <li className="grid gap-1.5" key={task}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs text-ink-faint">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="font-semibold">{TASK_LABELS[task]}</span>
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-ink">
                      {rate}% <span className="font-normal text-ink-muted">/ {learning.tasks[task].answered} 題</span>
                    </span>
                  </div>
                  <div className="h-2.5 border border-line-strong/20 bg-surface-raised">
                    <div className="h-full bg-contrast" style={{ width: `${rate}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
