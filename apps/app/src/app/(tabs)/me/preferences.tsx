import { StyleSheet, Text, View } from "react-native";

import { Loaded, Screen } from "@/components/ui/layout";
import { ListGroup, SwitchRow } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import type { Prefs } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { useOnline } from "@/data/network";
import { savePrefs } from "@/data/prefs";
import { usePrefs } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const SIZES = ["10", "20", "30", "50"] as const;

export default function PreferencesScreen() {
  const prefs = usePrefs();
  const online = useOnline();

  const save = (change: Partial<Prefs>) => {
    savePrefs(change).catch((reason) => {
      haptics.error();
      toast.error(errorMessage(reason));
    });
  };

  return (
    <Screen>
      <Text style={styles.desc}>
        {online ? "設定跟著帳號走，每台裝置都一樣。" : "離線時無法修改設定。"}
      </Text>
      <Loaded query={prefs}>
        {(value) => (
          <View style={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>外觀主題</Text>
              <Segmented<Prefs["theme"]>
                disabled={!online}
                value={value.theme}
                onChange={(theme) => {
                  save({ theme });
                }}
                options={[
                  { value: "system", label: "系統" },
                  { value: "light", label: "淺色" },
                  { value: "dark", label: "深色" },
                ]}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>每輪預設題數</Text>
              <Segmented
                disabled={!online}
                value={SIZES.find((size) => Number(size) === value.practiceSize) ?? "20"}
                onChange={(size) => {
                  save({ practiceSize: Number(size) });
                }}
                options={SIZES.map((size) => ({ value: size, label: `${size} 題` }))}
              />
              <Text style={styles.footer}>
                從練習頁開始時預設的題數，開始前仍可調整。
              </Text>
            </View>

            <ListGroup title="單字集">
              <SwitchRow
                title="在列表顯示中文意思"
                subtitle="關掉後可以先自己想意思"
                value={value.showMeanings}
                disabled={!online}
                onValueChange={(showMeanings) => save({ showMeanings })}
              />
            </ListGroup>
          </View>
        )}
      </Loaded>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desc: { ...type.hint, color: colors.inkMuted, paddingHorizontal: 4 },
  body: { gap: 20 },
  section: { gap: 8 },
  sectionTitle: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
  footer: { ...type.hint, color: colors.inkMuted, paddingHorizontal: 6 },
});
