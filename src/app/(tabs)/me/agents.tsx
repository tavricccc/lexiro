import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { SymbolView } from "expo-symbols";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { EmptyState, Loaded, Panel, Screen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { api, errorMessage, workerUrl } from "@/data/api";
import { keys } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

interface Connection {
  id: string;
  clientId: string;
  clientName: string;
  createdAt: number;
}

export default function AgentsScreen() {
  const connections = useQuery({
    queryKey: keys.connections,
    queryFn: () =>
      api<{ connections: Connection[] }>("/connections").then((result) => result.connections),
  });
  const endpoint = `${workerUrl}/mcp`;

  const copyEndpoint = () => {
    void Clipboard.setStringAsync(endpoint).then(() => {
      haptics.success();
      toast.success("已複製 MCP 網址");
    });
  };

  const confirmRevoke = (connection: Connection) => {
    haptics.warning();
    Alert.alert(
      "中斷連線？",
      `「${connection.clientName}」將不能再存取你的單字集，需要時可以重新連線。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "中斷連線",
          style: "destructive",
          onPress: () => {
            api(`/connections/${encodeURIComponent(connection.id)}`, { method: "DELETE" })
              .then(async () => {
                await connections.refetch();
                haptics.success();
                toast.success("已中斷連線");
              })
              .catch((reason) => {
                haptics.error();
                toast.error(errorMessage(reason));
              });
          },
        },
      ],
    );
  };

  return (
    <Screen refreshControl={<SyncRefreshControl />}>
      <Text style={styles.desc}>
        讓 Claude 等 AI 助理讀取你的單字集並幫你出題。題目由助理產生，Lexiro 只負責儲存。
      </Text>

      <Panel>
        <Text style={styles.label}>MCP 伺服器網址</Text>
        <View style={styles.urlRow}>
          <Text style={styles.urlText} numberOfLines={1} selectable>
            {endpoint}
          </Text>
          <Pressable
            hitSlop={8}
            accessibilityLabel="複製網址"
            onPress={copyEndpoint}
            style={styles.copyBtn}
          >
            <SymbolView name="doc.on.doc" size={17} weight="semibold" tintColor={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          在助理的「新增連接器」貼上這個網址，依指示用你的 Lexiro 帳號登入並允許存取即可。
        </Text>
      </Panel>

      <Loaded query={connections}>
        {(list) =>
          list.length ? (
            <ListGroup
              title="已連線"
              iconInset
              footer="中斷後，該助理就不能再讀寫你的單字集，需要時可以重新連線。"
            >
              {list.map((connection) => (
                <ListRow
                  key={connection.id}
                  icon="cpu"
                  title={connection.clientName}
                  subtitle={`連線於 ${new Date(
                    connection.createdAt * (connection.createdAt < 1e12 ? 1000 : 1),
                  ).toLocaleDateString("zh-TW")}`}
                  accessory={
                    <Pressable
                      hitSlop={10}
                      accessibilityLabel={`中斷 ${connection.clientName}`}
                      onPress={() => confirmRevoke(connection)}
                      style={styles.revokeBtn}
                    >
                      <SymbolView name="link.badge.plus" size={18} tintColor={colors.danger} />
                    </Pressable>
                  }
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              icon="cpu"
              title="還沒有連線的助理"
              description="連線後會列在這裡。"
            />
          )
        }
      </Loaded>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desc: { ...type.hint, color: colors.inkMuted, paddingHorizontal: 4 },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  urlText: { ...latin.medium, fontSize: 13, color: colors.ink, flex: 1 },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { ...type.hint, color: colors.inkMuted },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
