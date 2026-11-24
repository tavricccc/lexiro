import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, Screen, SectionTitle, Tile } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/progress";
import { calendarDay, PRACTICE_TASKS, shiftDay, streak, type Tally } from "@/core/contract";
import { FAMILIARITY_LABELS, TASK_LABELS } from "@/core/domain/labels";
import { useLearning } from "@/data/learning";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";

const WEEKS = 15;
const percent = (tally?: Tally) =>
  tally?.answered ? Math.round((tally.correct / tally.answered) * 100) : null;

export default function ProgressScreen() {
  const { learning } = useLearning();
  const today = calendarDay(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const stats = useMemo(() => {
    const days = Object.values(learning.days);
    const total = days.reduce(
      (sum, day) => ({ answered: sum.answered + day.answered, correct: sum.correct + day.correct }),
      { answered: 0, correct: 0 },
    );
    const levels = [0, 0, 0, 0];
    for (const sense of Object.values(learning.senses)) levels[sense.level] += 1;
    let best = 0;
    let run = 0;
    for (const day of Object.keys(learning.days).sort()) {
      run = learning.days[shiftDay(day, -1)]?.answered ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return { total, levels, best, practised: Object.keys(learning.senses).length };
  }, [learning]);

  const grid = useMemo(() => {
    const start = shiftDay(
      today,
      -(WEEKS * 7 - 1) - new Date(`${today}T12:00:00Z`).getUTCDay() + 6,
    );
    return Array.from({ length: WEEKS }, (_, week) =>
      Array.from({ length: 7 }, (_, weekday) => shiftDay(start, week * 7 + weekday)),
    );
  }, [today]);

  const peak = Math.max(
    learning.goal,
    ...Object.values(learning.days).map((day) => day.answered),
  );

  if (!stats.total.answered) {
    return (
      <Screen refreshControl={<SyncRefreshControl />}>
        <EmptyState
          icon="chart.line.uptrend.xyaxis"
          title="還沒有練習紀錄"
          description="練習過後，這裡會出現你的連續天數、答對率和熟悉度。"
          action={
            <Button
              label="開始練習"
              icon="play.fill"
              onPress={() => router.push("/practice")}
            />
          }
        />
      </Screen>
    );
  }

  const metrics: [string, number, string][] = [
    ["連續天數", streak(learning.days, today), "天"],
    ["最長連續", stats.best, "天"],
    ["總作答", stats.total.answered, "題"],
    ["答對率", percent(stats.total) ?? 0, "%"],
  ];

  const activeTasks = PRACTICE_TASKS.filter((task) => learning.tasks[task]?.answered);

  return (
    <Screen refreshControl={<SyncRefreshControl />}>
      {/* 2x2 Summary Metrics */}
      <View style={styles.metricGrid}>
        {metrics.map(([label, value, unit]) => (
          <Tile key={label} style={styles.metricTile}>
            <Text style={styles.metricLabel}>{label}</Text>
            <View style={styles.metricValueRow}>
              <AnimatedNumber value={value} style={styles.metricValue} />
              <Text style={styles.metricUnit}>{unit}</Text>
            </View>
          </Tile>
        ))}
      </View>

      {/* 15-Week Interactive Heatmap */}
      <Panel>
        <SectionTitle
          title={`最近 ${WEEKS} 週`}
          action={
            selectedDay ? (
              <Text style={styles.dayDetail}>
                <Text style={latin.semibold}>{selectedDay}</Text> ·{" "}
                {learning.days[selectedDay]?.answered ?? 0} 題
              </Text>
            ) : null
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.heatmapRow}
        >
          {grid.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.heatmapCol}>
              {week.map((day) => {
                const answered = learning.days[day]?.answered ?? 0;
                const future = day > today;
                const level = future
                  ? -1
                  : answered === 0
                    ? 0
                    : answered >= learning.goal
                      ? 4
                      : Math.ceil((answered / peak) * 3);
                const isToday = day === today;
                const isSelected = day === selectedDay;
                return (
                  <Pressable
                    key={day}
                    disabled={future}
                    onPress={() => {
                      haptics.select();
                      setSelectedDay((prev) => (prev === day ? null : day));
                    }}
                    accessibilityLabel={`${day}：${answered} 題`}
                    hitSlop={2}
                    style={({ pressed }) => [
                      styles.cell,
                      pressed && styles.cellPressed,
                      level < 0
                        ? styles.cellFuture
                        : level === 0
                          ? styles.cellEmpty
                          : [styles.cellFilled, { opacity: [0, 0.35, 0.6, 0.8, 1][level] }],
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
        <Text style={styles.hintText}>
          點選格子查看當天作答數，最深代表達成每日目標（{learning.goal} 題）。
        </Text>
      </Panel>

      {/* Familiarity Breakdown */}
      <Panel>
        <SectionTitle title="熟悉度" />
        <Text style={styles.subText}>
          練習過 <Text style={styles.subHighlight}>{stats.practised}</Text> 個字義
        </Text>
        <View style={styles.famBar}>
          {stats.levels.map((count, level) =>
            count > 0 ? (
              <View
                key={level}
                style={[
                  styles.famSegment,
                  {
                    flex: count,
                    opacity: 0.25 + level * 0.25,
                  },
                ]}
              />
            ) : null,
          )}
        </View>
        <View style={styles.famGrid}>
          {stats.levels.map((count, level) => (
            <View key={level} style={styles.famItem}>
              <View style={[styles.famDot, { opacity: 0.25 + level * 0.25 }]} />
              <Text style={styles.famLabel}>{FAMILIARITY_LABELS[level]}</Text>
              <Text style={styles.famCount}>{count}</Text>
            </View>
          ))}
        </View>
      </Panel>

      {/* Accuracy by Task */}
      {activeTasks.length > 0 ? (
        <Panel>
          <SectionTitle title="各題型答對率" />
          <View style={styles.taskList}>
            {activeTasks.map((task) => {
              const rate = percent(learning.tasks[task]) ?? 0;
              return (
                <View key={task} style={styles.taskRow}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskLabel}>{TASK_LABELS[task]}</Text>
                    <Text style={styles.taskStats}>
                      {rate}% · {learning.tasks[task].answered} 題
                    </Text>
                  </View>
                  <ProgressBar value={rate / 100} height={6} />
                </View>
              );
            })}
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    width: "48.3%",
    flexGrow: 1,
  },
  metricLabel: {
    ...type.hint,
    color: colors.inkMuted,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  metricValue: {
    ...latin.bold,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  metricUnit: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.inkFaint,
  },
  dayDetail: {
    ...type.hint,
    color: colors.contrast,
    fontWeight: "600",
  },
  heatmapRow: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 4,
  },
  heatmapCol: {
    gap: 5,
  },
  cell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderCurve: "continuous",
  },
  cellPressed: { transform: [{ scale: 0.82 }] },
  cellFuture: {
    backgroundColor: "transparent",
  },
  cellEmpty: {
    backgroundColor: colors.surfaceRaised,
  },
  cellFilled: {
    backgroundColor: colors.contrast,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.highlight,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: colors.ink,
  },
  hintText: {
    ...type.hint,
    color: colors.inkMuted,
  },
  subText: {
    ...type.hint,
    color: colors.inkMuted,
  },
  subHighlight: {
    ...latin.semibold,
    color: colors.ink,
  },
  famBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  famSegment: {
    height: "100%",
    backgroundColor: colors.contrast,
  },
  famGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  famItem: {
    width: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  famDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.contrast,
  },
  famLabel: {
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  famCount: {
    ...latin.semibold,
    fontSize: 14,
    color: colors.inkMuted,
  },
  taskList: {
    gap: 14,
  },
  taskRow: {
    gap: 6,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.ink,
  },
  taskStats: {
    ...latin.medium,
    fontSize: 13,
    color: colors.inkMuted,
  },
});
