import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { KeyboardScreen } from "@/components/ui/layout";
import { InputRow, ListGroup, ListRow, PickerRow } from "@/components/ui/list";
import { SetIcon } from "@/components/ui/set-icon";
import { SheetHeader } from "@/components/ui/sheet-header";
import type { SetSummary } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { copyWords, createFolder, createSet } from "@/data/library";
import { orderedSets, useLibrary } from "@/data/queries";
import { folderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const NO_FOLDER = "none";
const NEW_FOLDER = "new";

export default function CopyWordsSheet() {
  const { setId = "", ids = "" } = useLocalSearchParams<{ setId: string; ids: string }>();
  const wordIds = ids ? ids.split(",").filter(Boolean) : [];
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(NO_FOLDER);
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");

  const targets = orderedSets((library.data?.sets ?? []).filter((set) => set.id !== setId));
  const tree = folderTree(library.data?.folders ?? []);

  const copyTo = async (target: Pick<SetSummary, "id" | "name">) => {
    await copyWords(setId, wordIds, target.id);
    haptics.success();
    toast.success(`已複製到「${target.name}」`);
    router.back();
  };

  const createAndCopy = async () => {
    if (!name.trim()) {
      haptics.error();
      setError("請輸入單字集名稱");
      return;
    }
    if (folder === NEW_FOLDER && !folderName.trim()) {
      haptics.error();
      setError("請輸入資料夾名稱");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const folderId =
        folder === NEW_FOLDER
          ? (await createFolder({ name: folderName.trim() })).id
          : folder === NO_FOLDER
            ? null
            : folder;
      const created = await createSet({ name: name.trim(), folderId });
      await copyTo(created);
    } catch (reason) {
      haptics.error();
      setError(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <>
      <SheetHeader title={`複製 ${wordIds.length} 個單字到…`} />
      <KeyboardScreen mode="layout">
        {creating ? (
          <View style={styles.createBlock}>
            <ListGroup title="建立新單字集">
              <InputRow
                label="名稱"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError("");
                }}
                placeholder="新單字集名稱"
                maxLength={200}
                autoFocus
              />
              <PickerRow
                title="資料夾"
                value={folder}
                options={[
                  { value: NO_FOLDER, label: "不放資料夾" },
                  ...tree.flat.map(({ folder: entry }) => ({
                    value: entry.id,
                    label: tree.path(entry.id),
                  })),
                  { value: NEW_FOLDER, label: "新資料夾…" },
                ]}
                onChange={setFolder}
              />
              {folder === NEW_FOLDER ? (
                <InputRow
                  label="資料夾名稱"
                  value={folderName}
                  onChangeText={(text) => {
                    setFolderName(text);
                    setError("");
                  }}
                  placeholder="例如：高三上"
                  maxLength={80}
                />
              ) : null}
            </ListGroup>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.createActions}>
              <Button
                label="取消"
                variant="ghost"
                onPress={() => setCreating(false)}
                style={styles.halfBtn}
              />
              <Button
                label="建立並複製"
                icon="folder.badge.plus"
                busy={busy}
                haptic="confirm"
                onPress={() => void createAndCopy()}
                style={styles.halfBtn}
              />
            </View>
          </View>
        ) : (
          <Button
            label="建立新單字集"
            icon="plus"
            variant="secondary"
            onPress={() => setCreating(true)}
          />
        )}

        {targets.length > 0 ? (
          <ListGroup title="現有單字集" footer="同樣拼法的單字會合併，補上缺少的意思。">
            {targets.map((set) => (
              <ListRow
                key={set.id}
                title={set.name}
                subtitle={`${set.wordCount} 個單字`}
                leading={<SetIcon icon={set.icon} size={36} />}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await copyTo(set);
                  } catch (reason) {
                    haptics.error();
                    toast.error(errorMessage(reason));
                    setBusy(false);
                  }
                }}
              />
            ))}
          </ListGroup>
        ) : null}
      </KeyboardScreen>
    </>
  );
}

const styles = StyleSheet.create({
  createBlock: { gap: 12 },
  createActions: { flexDirection: "row", gap: 10 },
  halfBtn: { flex: 1 },
  error: { ...type.hint, color: colors.dangerInk, paddingHorizontal: 4 },
});
