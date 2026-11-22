import { useQueries } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-bar";
import { EmptyState, Panel, Screen } from "@/components/ui/layout";
import { CheckRow, ListGroup, ListRow } from "@/components/ui/list";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Segmented } from "@/components/ui/segmented";
import { SetIcon } from "@/components/ui/set-icon";
import type { PracticeTask, SetContent } from "@/core/contract";
import { TASK_HINTS, TASK_LABELS } from "@/core/domain/labels";
import { availableTasks, buildRound, type Focus } from "@/core/domain/practice";
import { newRound } from "@/core/domain/round";
import { api } from "@/data/api";
import { useLearning } from "@/data/learning";
import { keys, orderedSets, useLibrary, usePrefs } from "@/data/queries";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { haptics } from "@/lib/haptics";
import { colors, radius, space, type } from "@/lib/theme";

const AMOUNTS = ["10", "20", "30", "50"] as const;

export default function PracticeSetupScreen() {
  const params = useLocalSearchParams<{ set?: string; focus?: string }>();
  const library = useLibrary();
  const prefs = usePrefs();
  const { learning } = useLearning();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(loadRound);

  useFocusEffect(
    useCallback(() => {
      setSaved(loadRound());
    }, []),
  );

  const fromSets = useMemo(
    () => (params.set ? params.set.split(",").filter(Boolean) : []),
    [params.set],
  );
  const [chosen, setChosen] = useState<string[]>(fromSets);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [focus, setFocus] = useState<Focus>(() =>
    params.focus === "weak" || params.focus === "starred" ? params.focus : "all",
  );
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState("");

  const sets = useMemo(
    () => orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0),
    [library.data?.sets],
  );

  const ids = useMemo(
    () => (chosen.length ? chosen : sets.map((set) => set.id)),
    [chosen, sets],
  );

  const contents = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.set(id),
      queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`),
    })),
  });

  const loaded = contents.length > 0 && contents.every((query) => query.data);
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  const data = useMemo(
    () => contents.flatMap((query) => (query.data ? [query.data] : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  );

  const available = useMemo(() => (loaded ? availableTasks(data) : []), [loaded, data]);

  const activeTasks = useMemo(() => {
    if (!available.length) return [];
    const kept = tasks.filter((task) => available.includes(task));
    return kept.length ? kept : [available[0]];
  }, [available, tasks]);

  const size =
    amount ||
    String(AMOUNTS.find((value) => Number(value) >= (prefs.data?.practiceSize ?? 20)) ?? "20");

  if (library.data && !sets.length) {
    return (
      <Screen>
        <EmptyState
          icon="books.vertical"
          title="還沒有可以練習的單字"
          description="先在單字集裡加一些單字，就能開始練習。"
          action={
            <Button
              label="去加單字"
              icon="plus"
              onPress={() => router.push("/(tabs)/library")}
            />
          }
        />
      </Screen>
    );
  }

  const toggleSet = (id: string) => {
    setError("");
    setChosen((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleTask = (task: PracticeTask) => {
    haptics.select();
    setError("");
    setTasks(() =>
      activeTasks.includes(task)
        ? activeTasks.length > 1
          ? activeTasks.filter((value) => value !== task)
          : activeTasks
        : [...activeTasks, task],
    );
  };

  const start = () => {
    const items = buildRound({
      contents: data,
      tasks: activeTasks,
      amount: Number(size),
      focus,
      learning,
    });
    if (!items.length) {
      haptics.error();
      setError(
        focus === "starred"
          ? "選的單字集裡沒有標星的單字。"
          : "這些題型在選的單字集裡沒有可以出的題目。",
      );
      return;
    }
    haptics.confirm();
    saveRound(newRound(items, ids));
    router.push("/session");
  };

  return (
    <View style={styles.root}>
      <Screen contentContainerStyle={{ paddingBottom: 112 }}>
        {saved ? (
          <Panel style={styles.resumeCard}>
            <View style={styles.resumeText}>
              <Text style={styles.resumeTitle}>有一輪還沒做完</Text>
              <Text style={styles.resumeSub}>
                做到第 {Math.min(saved.index + 1, saved.items.length)} / {saved.items.length} 題
              </Text>
            </View>
            <View style={styles.resumeActions}>
              <Button
                label="捨棄"
                size="sm"
                variant="ghost"
                onPress={() => {
                  clearRound();
                  setSaved(null);
                }}
              />
              <Button
                label="繼續"
                icon="play.fill"
                size="sm"
                haptic="confirm"
                onPress={() => router.push("/session")}
              />
            </View>
          </Panel>
        ) : null}

        {fromSets.length > 0 ? (
          <ListGroup title="單字集">
            {sets
              .filter((set) => fromSets.includes(set.id))
              .map((set) => (
                <ListRow
                  key={set.id}
                  title={set.name}
                  subtitle={`${set.wordCount} 個單字${set.questionCount ? ` · ${set.questionCount} 題` : ""}`}
                  leading={<SetIcon icon={set.icon} size={36} />}
                />
              ))}
          </ListGroup>
        ) : (
          <ListGroup
            title="單字集"
            footer={chosen.length ? undefined : "沒有選的話，會從所有單字集出題。"}
          >
            {sets.map((set) => (
              <CheckRow
                key={set.id}
                title={set.name}
                subtitle={`${set.wordCount} 個單字${set.questionCount ? ` · ${set.questionCount} 題` : ""}`}
                leading={<SetIcon icon={set.icon} size={36} />}
                checked={chosen.includes(set.id)}
                onPress={() => toggleSet(set.id)}
              />
            ))}
          </ListGroup>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>題型</Text>
          {loaded ? (
            <View style={styles.taskGrid}>
              {available.map((task) => {
                const on = activeTasks.includes(task);
                return (
                  <PressableScale
                    key={task}
                    scaleTo={0.97}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => toggleTask(task)}
                    style={[styles.taskCard, on && styles.taskCardOn]}
                  >
                    <Text style={[styles.taskTitle, on && styles.taskTitleOn]}>
                      {TASK_LABELS[task]}
                    </Text>
                    <Text style={styles.taskHint} numberOfLines={2}>
                      {TASK_HINTS[task]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          ) : (
            <Text style={styles.loadingText}>正在讀取單字集…</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>出題方式</Text>
          <Segmented<Focus>
            value={focus}
            onChange={(next) => {
              setFocus(next);
              setError("");
            }}
            options={[
              { value: "all", label: "隨機" },
              { value: "weak", label: "不熟的優先" },
              { value: "starred", label: "只練標星" },
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>題數</Text>
          <Segmented
            value={size}
            onChange={setAmount}
            options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))}
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Screen>

      <View
        style={[styles.floatingWrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
        pointerEvents="box-none"
      >
        <GlassSurface style={styles.dock}>
          <Button
            label="開始練習"
            icon="play.fill"
            size="lg"
            disabled={!loaded || !activeTasks.length}
            haptic="confirm"
            onPress={start}
            style={styles.startBtn}
          />
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  resumeCard: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  resumeText: { flex: 1, minWidth: 160, gap: 2 },
  resumeTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  resumeSub: { ...type.hint, color: colors.inkMuted },
  resumeActions: { flexDirection: "row", gap: 8 },
  section: { gap: 8 },
  sectionLabel: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
  taskGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  taskCard: {
    width: "48.5%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14,
    gap: 4,
  },
  taskCardOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.contrast,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  taskTitleOn: {
    color: colors.accentInk,
  },
  taskHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkMuted,
  },
  loadingText: {
    ...type.hint,
    color: colors.inkFaint,
    paddingHorizontal: 4,
  },
  error: {
    ...type.hint,
    color: colors.dangerInk,
    paddingHorizontal: 6,
  },
  floatingWrap: {
    position: "absolute",
    left: space.gutter,
    right: space.gutter,
    alignItems: "center",
  },
  dock: {
    padding: 6,
    width: "100%",
    maxWidth: 420,
  },
  startBtn: { width: "100%" },
});
