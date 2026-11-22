import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { EmptyState, KeyboardScreen, Loaded, Tile } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { useIsAdministrator } from "@/data/admin";
import { api, errorMessage } from "@/data/api";
import { useAuth } from "@/data/auth";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

interface AdminAccount {
  uid: string;
  email: string;
  name: string;
  writesToday: number;
  readsToday: number;
  words: number;
  disabled: boolean;
}

interface Overview {
  day: string;
  accounts: number;
  activeToday: number;
  writesToday: number;
  readsToday: number;
  words: number;
  agentPaused: boolean;
  disabled: { uid: string; email: string; name: string; reason: string; disabledAt: number }[];
  top: AdminAccount[];
}

const n = (value: number) => value.toLocaleString("en-US");

export default function AdminScreen() {
  const admin = useIsAdministrator();
  const { account } = useAuth();
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api<Overview>("/admin/overview"),
    enabled: admin,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminAccount[] | null>(null);
  const [searching, setSearching] = useState(false);

  if (!admin) {
    return (
      <KeyboardScreen>
        <EmptyState
          icon="lock.shield"
          title="無法存取"
          description="這個帳號沒有管理權限。"
        />
      </KeyboardScreen>
    );
  }

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api<{ accounts: AdminAccount[] }>(
        `/admin/search?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(data.accounts);
      haptics.select();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setSearching(false);
    }
  };

  const toggleAccount = (uid: string, label: string, currentlyDisabled: boolean) => {
    const path = `/admin/accounts/${encodeURIComponent(uid)}/disabled`;
    const execute = async (reason = "") => {
      try {
        if (currentlyDisabled) await api(path, { method: "DELETE" });
        else await api(path, { method: "PUT", json: { reason } });
        setResults((list) =>
          list
            ? list.map((entry) =>
                entry.uid === uid ? { ...entry, disabled: !currentlyDisabled } : entry,
              )
            : null,
        );
        await overview.refetch();
        haptics.success();
      } catch (err) {
        haptics.error();
        toast.error(errorMessage(err));
      }
    };

    if (currentlyDisabled) {
      Alert.alert("恢復帳號？", `「${label}」將可以再次使用 Lexiro。`, [
        { text: "取消", style: "cancel" },
        { text: "恢復帳號", onPress: () => void execute() },
      ]);
    } else {
      haptics.warning();
      Alert.prompt(
        "停用帳號？",
        `「${label}」將無法讀寫資料。可選填原因：`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "停用帳號",
            style: "destructive",
            onPress: (reason?: string) => void execute(reason ?? ""),
          },
        ],
        "plain-text",
      );
    }
  };

  const renderAccountRow = (entry: AdminAccount) => {
    const label = entry.name || entry.email || entry.uid;
    return (
      <ListRow
        key={entry.uid}
        title={label}
        subtitle={`${entry.email || entry.uid} · ${n(entry.words)} 字 · 今日寫 ${n(entry.writesToday)} / 讀 ${n(entry.readsToday)}`}
        accessory={
          entry.uid === account?.uid ? undefined : (
            <Button
              label={entry.disabled ? "恢復" : "停用"}
              size="sm"
              variant={entry.disabled ? "secondary" : "danger"}
              onPress={() => toggleAccount(entry.uid, label, entry.disabled)}
            />
          )
        }
      />
    );
  };

  return (
    <KeyboardScreen refreshControl={<SyncRefreshControl />}>
      <Loaded query={overview}>
        {(data) => (
          <View style={styles.body}>
            <View style={styles.grid}>
              {(
                [
                  ["帳號", data.accounts],
                  ["今日活躍", data.activeToday],
                  ["今日寫入", data.writesToday],
                  ["今日讀取", data.readsToday],
                  ["單字總數", data.words],
                ] as const
              ).map(([label, value]) => (
                <Tile key={label} style={styles.tile}>
                  <Text style={styles.tileLabel}>{label}</Text>
                  <Text style={styles.tileValue}>{n(value)}</Text>
                </Tile>
              ))}
            </View>

            {data.agentPaused ? (
              <View style={styles.pauseBanner}>
                <Text style={styles.pauseText}>Agent 服務目前暫停中。</Text>
              </View>
            ) : null}

            <ListGroup title={`今日用量最高（${data.day}）`}>
              {data.top.length ? (
                data.top.map(renderAccountRow)
              ) : (
                <ListRow title="今天還沒有活動" />
              )}
            </ListGroup>

            {data.disabled.length > 0 ? (
              <ListGroup title="已停用">
                {data.disabled.map((entry) => {
                  const label = entry.name || entry.email || entry.uid;
                  return (
                    <ListRow
                      key={entry.uid}
                      title={label}
                      subtitle={`${entry.reason || "未填原因"} · ${new Date(entry.disabledAt).toLocaleDateString("zh-TW")}`}
                      accessory={
                        <Button
                          label="恢復"
                          size="sm"
                          variant="secondary"
                          onPress={() => toggleAccount(entry.uid, label, true)}
                        />
                      }
                    />
                  );
                })}
              </ListGroup>
            ) : null}
          </View>
        )}
      </Loaded>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋 Email、名稱或 UID"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
          style={styles.searchInput}
        />
        <Button
          label="搜尋"
          icon="magnifyingglass"
          disabled={!query.trim()}
          busy={searching}
          onPress={() => void search()}
        />
      </View>

      {results ? (
        <ListGroup title="搜尋結果">
          {results.length ? results.map(renderAccountRow) : <ListRow title="找不到符合的帳號" />}
        </ListGroup>
      ) : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.3%", flexGrow: 1 },
  tileLabel: { ...type.hint, color: colors.inkMuted },
  tileValue: { ...latin.bold, fontSize: 24, color: colors.ink },
  pauseBanner: {
    backgroundColor: colors.cautionSoft,
    borderRadius: radius.tile,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pauseText: { ...type.hint, fontWeight: "600", color: colors.caution },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
});
