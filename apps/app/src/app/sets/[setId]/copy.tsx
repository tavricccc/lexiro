import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FolderPickerRow, LIBRARY_ROOT } from "@/components/library/folder-picker";
import { Button } from "@/components/ui/button";
import { KeyboardScreen } from "@/components/ui/layout";
import { InputRow, ListGroup, ListRow } from "@/components/ui/list";
import { SetIcon } from "@/components/ui/set-icon";
import { SheetHeader } from "@/components/ui/sheet-header";
import type { SetSummary } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { copyWords, createSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { orderedSets, useLibrary } from "@/data/queries";
import { folderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { colors, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function CopyWordsSheet() {
  const { setId = "", ids = "" } = useLocalSearchParams<{ setId: string; ids: string }>();
  const wordIds = ids ? ids.split(",").filter(Boolean) : [];
  const library = useLibrary();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const source = library.data?.sets.find((set) => set.id === setId);
  /** Where the new set goes; until picked, beside the set the words come from. */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const folder = picked === undefined ? (source?.folderId ?? null) : picked;
  const [error, setError] = useState("");

  const folders = library.data?.folders;
  const tree = useMemo(() => folderTree(folders ?? []), [folders]);
  // The other sets, laid out as the library is: 我的單字 first, then each
  // folder in tree order, named by its path.
  const groups = useMemo(() => {
    const others = (library.data?.sets ?? []).filter((set) => set.id !== setId);
    const inFolder = (folderId: string | null) =>
      orderedSets(
        others.filter((set) => (tree.get(set.folderId) ? set.folderId : null) === folderId),
      );
    return [
      { key: "root", title: LIBRARY_ROOT, sets: inFolder(null) },
      ...tree.flat.map(({ folder: entry }) => ({
        key: entry.id,
        title: tree.path(entry.id),
        sets: inFolder(entry.id),
      })),
    ].filter((group) => group.sets.length > 0);
  }, [library.data?.sets, setId, tree]);

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
    setBusy(true);
    setError("");
    try {
      const created = await createSet({
        name: name.trim(),
        folderId: tree.get(folder) ? folder : null,
      });
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
              <FolderPickerRow
                folders={folders ?? []}
                value={folder}
                onChange={setPicked}
                canCreate={online}
                disabled={busy}
              />
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

        {groups.map((group, i) => (
          <ListGroup
            key={group.key}
            title={group.title}
            footer={i === groups.length - 1 ? "同樣拼法的單字會合併，補上缺少的意思。" : undefined}
          >
            {group.sets.map((set) => (
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
        ))}
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
