import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { KeyboardScreen, Panel } from "@/components/ui/layout";
import { InputRow, ListGroup, ListRow, PickerRow } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import type { PracticeTask, SetContent } from "@/core/contract";
import { TASK_LABELS } from "@/core/domain/labels";
import { availableTasks, buildRound } from "@/core/domain/practice";
import { ROOM_CODE, roomQuestions } from "@/core/domain/room";
import { api, errorMessage } from "@/data/api";
import { useAuth } from "@/data/auth";
import { useLearning } from "@/data/learning";
import { useOnline } from "@/data/network";
import { keys, orderedSets, useLibrary } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const AMOUNTS = ["10", "20", "30"] as const;
const SECONDS = ["auto", "15", "25", "40"] as const;
type Seconds = (typeof SECONDS)[number];

export default function RoomsScreen() {
  const { account } = useAuth();
  const online = useOnline();
  const active = useQuery({
    queryKey: keys.activeRoom,
    queryFn: () =>
      api<{ room: { code: string; title: string; phase: string } | null }>("/rooms/active"),
  });
  const [code, setCode] = useState("");
  const normalized = code.trim().toUpperCase();

  const join = () => {
    if (!ROOM_CODE.test(normalized)) {
      haptics.error();
      toast.error("房間代碼是 6 個英數字。");
      return;
    }
    haptics.confirm();
    router.push({ pathname: "/room/[code]", params: { code: normalized } });
  };

  return (
    <KeyboardScreen refreshControl={<SyncRefreshControl />}>
      <Text style={styles.subtitle}>用同一組題目和朋友即時比快、比準。</Text>

      {active.data?.room ? (
        <Panel style={styles.activeCard}>
          <View style={styles.activeText}>
            <Text style={styles.activeTitle}>你開的房間還在進行</Text>
            <Text style={styles.activeSub} numberOfLines={1}>
              {active.data.room.title} ·{" "}
              <Text style={latin.bold}>{active.data.room.code}</Text>
            </Text>
          </View>
          <Button
            label="回到房間"
            size="sm"
            haptic="confirm"
            onPress={() =>
              router.push({
                pathname: "/room/[code]",
                params: { code: active.data!.room!.code },
              })
            }
          />
        </Panel>
      ) : null}

      <Panel>
        <Text style={styles.cardTitle}>加入房間</Text>
        <View style={styles.joinRow}>
          <TextInput
            accessibilityLabel="房間代碼"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^a-z0-9]/gi, "").toUpperCase())}
            onSubmitEditing={join}
            returnKeyType="go"
            placeholder="ABC234"
            placeholderTextColor={colors.inkFaint}
            editable={online}
            style={styles.codeInput}
          />
          <Button
            label="加入"
            icon="arrow.right"
            disabled={!online || normalized.length !== 6}
            onPress={join}
          />
        </View>
      </Panel>

      {account ? <HostForm defaultName={account.name} online={online} /> : null}
    </KeyboardScreen>
  );
}

function HostForm({ defaultName, online }: { defaultName: string; online: boolean }) {
  const library = useLibrary();
  const { learning } = useLearning();
  const sets = useMemo(
    () => orderedSets(library.data?.sets ?? []).filter((set) => set.wordCount > 0),
    [library.data?.sets],
  );
  const [setId, setSetId] = useState("");
  const chosen = setId || sets[0]?.id || "";

  const content = useQuery({
    queryKey: keys.set(chosen),
    queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(chosen)}`),
    enabled: Boolean(chosen),
  });

  const tasks = useMemo(
    () => (content.data ? availableTasks([content.data]).filter((task) => task !== "custom") : []),
    [content.data],
  );
  const [task, setTask] = useState<Exclude<PracticeTask, "custom"> | "">("");
  const picked = task && tasks.includes(task) ? task : tasks[0];
  const [amount, setAmount] = useState<string>("10");
  const [seconds, setSeconds] = useState<Seconds>("auto");
  const [name, setName] = useState(defaultName.slice(0, 40));
  const [busy, setBusy] = useState(false);

  if (library.data && !sets.length) {
    return (
      <ListGroup title="開房間">
        <ListRow title="還沒有可以出題的單字集" subtitle="先在單字集裡加一些單字。" />
      </ListGroup>
    );
  }

  const selectedSet = sets.find((entry) => entry.id === chosen);

  const host = async () => {
    if (!content.data || !picked || !selectedSet) return;
    const questions = roomQuestions(
      buildRound({
        contents: [content.data],
        tasks: [picked],
        amount: Number(amount),
        focus: "all",
        learning,
      }),
    );
    if (!questions.length) {
      haptics.error();
      toast.error("這個題型在這個單字集裡沒有可以出的題目。");
      return;
    }
    setBusy(true);
    try {
      const { code } = await api<{ code: string }>("/rooms", {
        method: "POST",
        json: {
          name: name.trim() || defaultName,
          title: `${selectedSet.name} · ${TASK_LABELS[picked]}`.slice(0, 120),
          ...(seconds === "auto" ? {} : { seconds: Number(seconds) }),
          questions,
        },
      });
      haptics.success();
      router.push({ pathname: "/room/[code]", params: { code } });
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.hostWrap}>
      <ListGroup title="開房間">
        <InputRow
          label="你的暱稱"
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder="輸入暱稱"
        />
        {sets.length > 0 ? (
          <PickerRow
            title="單字集"
            icon="books.vertical"
            value={chosen}
            options={sets.map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={setSetId}
          />
        ) : null}
        {tasks.length > 0 ? (
          <PickerRow
            title="題型"
            icon="list.bullet.rectangle"
            value={picked ?? ""}
            options={tasks.map((value) => ({ value, label: TASK_LABELS[value] }))}
            onChange={(next) => setTask(next as Exclude<PracticeTask, "custom">)}
          />
        ) : (
          <ListRow title="題型" detail="讀取中…" />
        )}
      </ListGroup>

      <View style={styles.segSection}>
        <Text style={styles.segLabel}>題數</Text>
        <Segmented
          value={amount}
          onChange={setAmount}
          options={AMOUNTS.map((value) => ({ value, label: `${value} 題` }))}
        />
      </View>

      <View style={styles.segSection}>
        <Text style={styles.segLabel}>每題秒數</Text>
        <Segmented<Seconds>
          value={seconds}
          onChange={setSeconds}
          options={SECONDS.map((value) => ({
            value,
            label: value === "auto" ? "依題型" : `${value} 秒`,
          }))}
        />
      </View>

      <Button
        label="開房間"
        icon="bolt.shield.fill"
        size="lg"
        busy={busy}
        disabled={!online || !picked || !content.data}
        haptic="confirm"
        onPress={() => void host()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...type.body,
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeText: { flex: 1, gap: 2 },
  activeTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  activeSub: { ...type.hint, color: colors.inkMuted },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  joinRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  codeInput: {
    ...latin.bold,
    flex: 1,
    minHeight: 48,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 6,
    color: colors.ink,
  },
  hostWrap: { gap: 16 },
  segSection: { gap: 8 },
  segLabel: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
});
