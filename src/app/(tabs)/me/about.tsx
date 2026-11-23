import { SymbolView } from "expo-symbols";
import * as Updates from "expo-updates";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Panel, Screen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { applyUpdate as restartIntoUpdate } from "@/lib/app-updates";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { APP_VERSION } from "@/lib/version";
import { toast } from "@/platform/toast";

export default function AboutScreen() {
  const { isUpdatePending, isUpdateAvailable } = Updates.useUpdates();
  const [checking, setChecking] = useState(false);
  const supported = !__DEV__ && Updates.isEnabled;

  const checkUpdate = async () => {
    if (!supported) return;
    setChecking(true);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await Updates.fetchUpdateAsync();
        haptics.success();
        toast.success("已下載新版本，點「立即更新」即可套用");
      } else {
        haptics.select();
        toast.info("已是最新版本");
      }
    } catch {
      haptics.error();
      toast.error("目前無法檢查更新");
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = () => {
    haptics.confirm();
    void restartIntoUpdate();
  };

  const statusText = !supported
    ? "開發模式不支援線上更新"
    : isUpdatePending
      ? "有新版本已下載完成"
      : isUpdateAvailable
        ? "有新版本可以更新"
        : "已是最新版本";

  return (
    <Screen>
      <Panel style={styles.hero}>
        <View style={styles.badge}>
          <SymbolView name="books.vertical.fill" size={28} weight="medium" tintColor={colors.onContrast} />
        </View>
        <Text style={styles.brand}>Lexiro</Text>
        <Text style={styles.tagline}>把背單字變成每天的小習慣。</Text>
        <Text style={styles.version}>版本 {APP_VERSION}</Text>
      </Panel>

      <ListGroup title="更新">
        <ListRow
          icon="arrow.triangle.2.circlepath"
          title={statusText}
          subtitle={Updates.runtimeVersion ? `Runtime ${Updates.runtimeVersion.slice(0, 12)}` : undefined}
          accessory={
            isUpdatePending ? (
              <Button label="立即更新" size="sm" onPress={applyUpdate} />
            ) : supported ? (
              <Button
                label="檢查"
                size="sm"
                variant="secondary"
                busy={checking}
                onPress={() => void checkUpdate()}
              />
            ) : undefined
          }
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 6,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: radius.card,
    borderCurve: "continuous",
    backgroundColor: colors.contrast,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  brand: { ...latin.heavy, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  tagline: { ...type.body, color: colors.inkMuted },
  version: { ...latin.medium, fontSize: 13, color: colors.inkFaint, marginTop: 2 },
});
