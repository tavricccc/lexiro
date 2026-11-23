import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { EmptyState, Screen, SectionTitle } from "@/components/ui/layout";
import { NativeMenuTrigger } from "@/components/ui/list";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SetIcon } from "@/components/ui/set-icon";
import { calendarDay, DAILY_GOALS, streak, type DailyGoal } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { setGoal, useLearning, usePendingAnswers } from "@/data/learning";
import { orderedSets, useLibrary, useStarredWords } from "@/data/queries";
import { loadRound } from "@/data/round-store";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function TodayScreen() {
  const { learning } = useLearning();
  const library = useLibrary();
  const pending = usePendingAnswers();
  const starred = useStarredWords();
  const [saved, setSaved] = useState(loadRound);

  useFocusEffect(
    useCallback(() => {
      setSaved(loadRound());
    }, []),
  );

  const today = calendarDay(new Date());
  const done = learning.days[today]?.answered ?? 0;
  const left = Math.max(0, learning.goal - done);
  const days = streak(learning.days, today);

  const recent = useMemo(
    () =>
      orderedSets(library.data?.sets ?? [])
        .filter((set) => set.wordCount > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, starred.count ? 3 : 4),
    [library.data?.sets, starred.count],
  );

  const changeGoal = (goal: DailyGoal) => {
    setGoal(goal)
      .then(() => haptics.success())
      .catch((reason) => {
        haptics.error();
        toast.error(errorMessage(reason));
      });
  };

  return (
    <Screen refreshControl={<SyncRefreshControl />}>
      {/* Ink Goal Hero Card */}
      <View style={styles.heroCard} accessibilityLabel="今日目標">
        <View style={styles.heroTop}>
          <NativeMenuTrigger
            label="每日目標"
            items={DAILY_GOALS.map((goal) => ({
              key: String(goal),
              label: `每天 ${goal} 題`,
              systemImage: learning.goal === goal ? "checkmark" : "target",
              onPress: () => changeGoal(goal),
            }))}
          >
            <View style={styles.goalTrigger}>
              <Text style={styles.heroTopText}>
                今日目標 <Text style={latin.semibold}>{learning.goal}</Text> 題
              </Text>
              <SymbolView
                name="chevron.down"
                size={12}
                weight="bold"
                tintColor={colors.heroMuted}
              />
            </View>
          </NativeMenuTrigger>

          {days > 0 ? (
            <View style={styles.streakPill}>
              <SymbolView name="flame.fill" size={14} weight="semibold" tintColor={colors.highlight} />
              <Text style={styles.heroTopText}>
                連續 <Text style={latin.bold}>{days}</Text> 天
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.scoreRow}>
          <AnimatedNumber value={done} style={styles.bigNumber} />
          <Text style={styles.goalSuffix}> / {learning.goal}</Text>
        </View>

        <View style={styles.segmentGrid} accessible={false}>
          {Array.from({ length: learning.goal }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segmentBar,
                index < done ? styles.segmentFilled : styles.segmentEmpty,
              ]}
            />
          ))}
        </View>

        {saved ? (
          <Button
            label={`繼續上次 ${Math.min(saved.index + 1, saved.items.length)}/${saved.items.length}`}
            icon="play.fill"
            variant="hero"
            size="lg"
            haptic="confirm"
            onPress={() => router.push("/session")}
          />
        ) : (
          <Button
            label={left ? `再練 ${left} 題` : "多練幾題"}
            icon="play.fill"
            variant="hero"
            size="lg"
            haptic="confirm"
            onPress={() => router.push("/practice")}
          />
        )}

        {pending > 0 ? (
          <Text style={styles.pendingNote}>
            有 {pending} 筆作答還沒上傳，連線後會自動送出。
          </Text>
        ) : null}
      </View>

      {/* Recent Sets + Starred Tile */}
      <View style={styles.section}>
        <SectionTitle
          title="單字集"
          action={
            <Button
              label="自選練習"
              trailingIcon="arrow.right"
              size="sm"
              variant="ghost"
              onPress={() => router.push("/practice")}
            />
          }
        />

        {library.data && !recent.length ? (
          <EmptyState
            icon="books.vertical"
            title="還沒有單字"
            description="加入單字後就能開始練習。"
            action={
              <Button
                label="建立第一個單字集"
                icon="plus"
                onPress={() => router.push("/sets/new")}
              />
            }
          />
        ) : (
          <View style={styles.tileGrid}>
            {recent.map((set) => (
              <PressableScale
                key={set.id}
                scaleTo={0.97}
                onPress={() => {
                  haptics.tap();
                  router.push({ pathname: "/practice", params: { set: set.id } });
                }}
                style={styles.setTile}
              >
                <SetIcon icon={set.icon} size={38} />
                <View style={styles.tileMeta}>
                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {set.name}
                  </Text>
                  <Text style={styles.tileSub}>
                    <Text style={latin.semibold}>{set.wordCount}</Text> 字
                  </Text>
                </View>
              </PressableScale>
            ))}

            {starred.count > 0 ? (
              <PressableScale
                scaleTo={0.97}
                onPress={() => {
                  haptics.tap();
                  router.push("/library/starred");
                }}
                style={styles.setTile}
              >
                <View style={styles.starIconBox}>
                  <SymbolView name="star.fill" size={20} weight="semibold" tintColor={colors.highlight} />
                </View>
                <View style={styles.tileMeta}>
                  <Text style={styles.tileTitle}>標星單字</Text>
                  <Text style={styles.tileSub} numberOfLines={1}>
                    <Text style={latin.semibold}>{starred.count}</Text> 字 · {starred.groups.length} 個單字集
                  </Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.heroBg,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 20,
    gap: 16,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  goalTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingRight: 6,
  },
  heroTopText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.heroMuted,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  bigNumber: {
    ...type.heroNumber,
    color: colors.heroText,
  },
  goalSuffix: {
    ...latin.bold,
    fontSize: 28,
    color: colors.heroFaint,
  },
  segmentGrid: {
    flexDirection: "row",
    gap: 3,
  },
  segmentBar: {
    flex: 1,
    height: 14,
    borderRadius: 4,
    borderCurve: "continuous",
  },
  segmentFilled: {
    backgroundColor: colors.heroText,
  },
  segmentEmpty: {
    backgroundColor: colors.heroTrack,
  },
  pendingNote: {
    ...type.hint,
    color: colors.heroMuted,
  },
  section: {
    gap: 12,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  setTile: {
    width: "48.3%",
    flexGrow: 1,
    minHeight: 128,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    justifyContent: "space-between",
    gap: 12,
  },
  starIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderCurve: "continuous",
    backgroundColor: colors.highlightSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tileMeta: {
    gap: 2,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 21,
  },
  tileSub: {
    ...type.hint,
    color: colors.inkMuted,
  },
});
