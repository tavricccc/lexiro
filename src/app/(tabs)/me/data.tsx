import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";

import { Button } from "@/components/ui/button";
import { Panel, Screen } from "@/components/ui/layout";
import { api, errorMessage } from "@/data/api";
import { useOnline } from "@/data/network";
import { invalidate } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { exportBackupFile, pickBackupFile } from "@/platform/backup-files";
import { toast } from "@/platform/toast";

export default function DataBackupScreen() {
  const online = useOnline();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await api<unknown>("/backup");
      await exportBackupFile(backup);
      haptics.success();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    let picked: { name: string; data: unknown } | null;
    try {
      picked = await pickBackupFile();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
      return;
    }
    if (!picked) return;

    const chosen = picked;
    haptics.select();
    Alert.alert(
      "匯入備份？",
      `要從「${chosen.name}」匯入嗎？內容會加到你現有的單字集旁邊，不會覆蓋或刪除現有資料。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "匯入",
          onPress: async () => {
            setImporting(true);
            try {
              const result = await api<{ sets: number; words: number; questions: number }>(
                "/backup",
                { method: "POST", json: chosen.data },
              );
              await invalidate();
              haptics.success();
              toast.success(
                `已匯入 ${result.sets} 個單字集、${result.words} 個單字、${result.questions} 題`,
              );
            } catch (reason) {
              haptics.error();
              toast.error(errorMessage(reason));
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Panel>
        <Text style={styles.title}>匯出備份</Text>
        <Text style={styles.desc}>
          下載一份包含所有資料夾、單字集、單字和題目的 JSON 檔，可存到「檔案」或透過 AirDrop 傳送。練習紀錄不包含在內。
        </Text>
        <Button
          label="匯出並儲存備份"
          icon="square.and.arrow.up"
          size="lg"
          disabled={!online}
          busy={exporting}
          haptic="confirm"
          onPress={() => void handleExport()}
        />
      </Panel>

      <Panel>
        <Text style={styles.title}>匯入備份</Text>
        <Text style={styles.desc}>
          備份裡的單字集會新增為新的單字集，不會覆蓋或刪除現有的資料。
        </Text>
        <Button
          label="選擇備份檔"
          icon="square.and.arrow.down"
          variant="secondary"
          size="lg"
          disabled={!online}
          busy={importing}
          onPress={() => void handleImport()}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  desc: { ...type.body, color: colors.inkMuted },
});
