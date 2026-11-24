import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Avatar } from "@/components/ui/avatar";
import { Panel, Screen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { useIsAdministrator } from "@/data/admin";
import { useAuth } from "@/data/auth";
import { usePendingAnswers } from "@/data/learning";
import { colors, type } from "@/lib/theme";

export default function MeScreen() {
  const { account } = useAuth();
  const admin = useIsAdministrator();
  const pending = usePendingAnswers();

  return (
    <Screen refreshControl={<SyncRefreshControl />}>
      <Panel style={styles.profile}>
        <Avatar
          name={account?.name || account?.email || "?"}
          uri={account?.photo}
          size={56}
        />
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={1}>
            {account?.name || "Lexiro 使用者"}
          </Text>
          {account?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {account.email}
            </Text>
          ) : null}
        </View>
      </Panel>

      <ListGroup title="設定" iconInset>
        <ListRow
          icon="person.crop.circle"
          title="帳號與同步"
          subtitle={pending ? `${pending} 筆作答等待上傳` : "登入、同步與登出"}
          chevron
          onPress={() => router.push("/me/account")}
        />
        <ListRow
          icon="slider.horizontal.3"
          title="偏好設定"
          subtitle="外觀、練習題數、單字列表"
          chevron
          onPress={() => router.push("/me/preferences")}
        />
        <ListRow
          icon="externaldrive"
          title="資料與備份"
          subtitle="匯出、匯入備份"
          chevron
          onPress={() => router.push("/me/data")}
        />
        <ListRow
          icon="cpu"
          title="Agent 連線"
          subtitle="讓 AI 助理幫你出題"
          chevron
          onPress={() => router.push("/me/agents")}
        />
      </ListGroup>

      <ListGroup title="其他" iconInset>
        <ListRow
          icon="info.circle"
          title="關於 Lexiro"
          subtitle="版本與更新"
          chevron
          onPress={() => router.push("/me/about")}
        />
        {admin ? (
          <ListRow
            icon="checkmark.shield"
            title="管理後台"
            chevron
            onPress={() => router.push("/me/admin")}
          />
        ) : null}
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileText: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink },
  email: { ...type.hint, color: colors.inkMuted },
});
