import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { KeyboardScreen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SheetHeader } from "@/components/ui/sheet-header";
import type { Folder } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { createFolder, deleteFolder, updateFolder } from "@/data/library";
import { useOnline } from "@/data/network";
import { useLibrary } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function FoldersSheetScreen() {
  const library = useLibrary();
  const online = useOnline();
  const folders = library.data?.folders ?? [];
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      haptics.success();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed || busy || !online) return;
    void run(async () => {
      await createFolder({ name: trimmed, order: folders.length });
      setName("");
    });
  };

  const rename = (folder: Folder) => {
    haptics.select();
    Alert.prompt(
      "重新命名資料夾",
      undefined,
      [
        { text: "取消", style: "cancel" },
        {
          text: "儲存",
          onPress: (next?: string) => {
            const trimmed = next?.trim();
            if (!trimmed || trimmed === folder.name) return;
            void run(() => updateFolder(folder, { name: trimmed }));
          },
        },
      ],
      "plain-text",
      folder.name,
    );
  };

  const remove = (folder: Folder) => {
    haptics.warning();
    Alert.alert(
      `刪除「${folder.name}」？`,
      "裡面的單字集會移到上一層，不會被刪除。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => void run(() => deleteFolder(folder.id)),
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <SheetHeader title="管理資料夾" />
      <KeyboardScreen>
        <View style={styles.addRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="新資料夾名稱"
            placeholderTextColor={colors.inkFaint}
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={add}
            editable={online && !busy}
            style={styles.input}
          />
          <Button
            label="新增"
            icon="plus"
            size="md"
            disabled={!name.trim() || !online}
            busy={busy}
            onPress={add}
          />
        </View>

        {folders.length > 0 ? (
          <ListGroup
            title="資料夾"
            footer="刪除資料夾不會刪除裡面的單字集，它們會移到上一層。"
          >
            {folders.map((folder) => (
              <ListRow
                key={folder.id}
                title={folder.name}
                icon="folder.fill"
                accessory={
                  <View style={styles.rowActions}>
                    <Pressable
                      hitSlop={8}
                      disabled={!online || busy}
                      accessibilityLabel={`重新命名 ${folder.name}`}
                      onPress={() => rename(folder)}
                      style={styles.iconBtn}
                    >
                      <SymbolView name="pencil" size={17} tintColor={colors.inkMuted} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      disabled={!online || busy}
                      accessibilityLabel={`刪除 ${folder.name}`}
                      onPress={() => remove(folder)}
                      style={styles.iconBtn}
                    >
                      <SymbolView name="trash" size={17} tintColor={colors.danger} />
                    </Pressable>
                  </View>
                }
              />
            ))}
          </ListGroup>
        ) : (
          <Text style={styles.empty}>還沒有資料夾</Text>
        )}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
    paddingVertical: 28,
  },
});
