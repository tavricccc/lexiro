import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";

import { Panel, Screen } from "@/components/ui/layout";
import { ActionRow, ListGroup, ListRow } from "@/components/ui/list";
import { api, errorMessage } from "@/data/api";
import { deleteAccount, SignInCancelled, signOut, useAuth } from "@/data/auth";
import { flushAnswers, usePendingAnswers } from "@/data/learning";
import { useOnline } from "@/data/network";
import { refreshAll } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function AccountScreen() {
  const { account } = useAuth();
  const pending = usePendingAnswers();
  const online = useOnline();
  const [syncing, setSyncing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [erasing, setErasing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await flushAnswers();
      await refreshAll();
      haptics.success();
      toast.success("已同步最新資料");
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setSyncing(false);
    }
  };

  const doSignOut = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setLeaving(false);
    }
  };

  const handleSignOut = () => {
    if (pending > 0) {
      haptics.warning();
      Alert.alert(
        "還有作答沒上傳",
        `還有 ${pending} 筆作答沒有上傳，登出後會遺失。建議先連上網路同步。`,
        [
          { text: "取消", style: "cancel" },
          { text: "仍然登出", style: "destructive", onPress: () => void doSignOut() },
        ],
      );
      return;
    }
    void doSignOut();
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      "永久刪除帳號？",
      "刪除前會請你重新登入一次確認身分。所有單字集、題目、練習紀錄與分享連結都會永久消失，無法復原。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "永久刪除",
          style: "destructive",
          onPress: async () => {
            setErasing(true);
            try {
              await deleteAccount(() => api("/account", { method: "DELETE" }).then(() => undefined));
              haptics.success();
            } catch (reason) {
              if (!(reason instanceof SignInCancelled)) {
                haptics.error();
                toast.error(errorMessage(reason));
              }
              setErasing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Panel style={styles.accountCard}>
        <Text style={styles.label}>登入帳號</Text>
        <Text style={styles.email}>{account?.email || account?.name}</Text>
        <Text style={styles.hint}>
          你的單字集、練習紀錄和設定都存在這個帳號，換裝置登入同一個帳號就會出現。
        </Text>
      </Panel>

      <ListGroup
        title="同步"
        iconInset
        footer={
          online
            ? "Lexiro 會自動同步；離線時可以瀏覽和練習，作答會在連線後送出。"
            : "目前離線：可以瀏覽和練習，但不能修改單字集。"
        }
      >
        <ListRow
          icon="tray.and.arrow.up"
          title="尚未上傳的作答"
          detail={pending ? `${pending} 筆` : "沒有"}
        />
        <ListRow
          icon="arrow.clockwise"
          title="立即同步"
          detail={syncing ? "同步中…" : undefined}
          disabled={!online || syncing}
          onPress={() => void sync()}
        />
      </ListGroup>

      <ListGroup title="帳號" iconInset>
        <ActionRow
          icon="rectangle.portrait.and.arrow.right"
          title="登出"
          disabled={leaving}
          onPress={handleSignOut}
        />
      </ListGroup>

      <ListGroup
        title="危險區域"
        iconInset
        footer="會永久刪除這個帳號的單字集、題目、練習紀錄與分享連結，無法復原。"
      >
        <ActionRow
          icon="trash"
          title={erasing ? "處理中…" : "刪除帳號"}
          destructive
          disabled={!online || erasing}
          onPress={confirmDelete}
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: { gap: 4 },
  label: { ...type.hint, color: colors.inkMuted },
  email: { fontSize: 17, fontWeight: "600", color: colors.ink },
  hint: { ...type.hint, color: colors.inkMuted, marginTop: 4 },
});
