import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { SetForm, type SetFormValue } from "@/components/library/set-form";
import { Button } from "@/components/ui/button";
import { KeyboardScreen, Loaded } from "@/components/ui/layout";
import { ActionRow, ListGroup } from "@/components/ui/list";
import { SheetHeader } from "@/components/ui/sheet-header";
import type { SetContent } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { deleteSet, updateSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { useLibrary, useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function SetSettingsScreen() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const content = useSet(setId);

  return (
    <View style={styles.root}>
      <SheetHeader title="單字集設定" />
      <KeyboardScreen>
        <Loaded query={content}>
          {(data) => <SettingsBody content={data} key={data.set.updatedAt} />}
        </Loaded>
      </KeyboardScreen>
    </View>
  );
}

function SettingsBody({ content }: { content: SetContent }) {
  const { set } = content;
  const library = useLibrary();
  const online = useOnline();
  const [value, setValue] = useState<SetFormValue>({
    name: set.name,
    folderId: set.folderId,
    hue: set.hue,
    icon: set.icon,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const changed =
    value.name !== set.name ||
    value.folderId !== set.folderId ||
    value.hue !== set.hue ||
    value.icon !== set.icon;

  const save = async () => {
    if (!value.name.trim()) {
      haptics.error();
      setError("請輸入名稱");
      return;
    }
    setSaving(true);
    try {
      await updateSet(set, { ...value, name: value.name.trim() });
      haptics.success();
      toast.success("已儲存");
      router.back();
    } catch (reason) {
      haptics.error();
      setError(errorMessage(reason));
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      `刪除「${set.name}」？`,
      `${content.words.length} 個單字和 ${content.questions.length} 題會一起刪除，無法復原。練習紀錄會保留。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            deleteSet(set.id)
              .then(() => {
                haptics.success();
                toast.success(`已刪除「${set.name}」`);
                router.dismissAll();
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
    <View style={styles.body}>
      <SetForm
        online={online}
        value={value}
        folders={library.data?.folders ?? []}
        error={error}
        onChange={(next) => {
          setValue(next);
          setError("");
        }}
      />

      <Button
        label="儲存變更"
        icon="checkmark"
        size="lg"
        busy={saving}
        disabled={!changed || !online}
        haptic="confirm"
        onPress={() => void save()}
      />

      <ListGroup
        title="危險區域"
        footer="單字、題目和分享連結會一起刪除，無法復原。練習紀錄會保留。"
      >
        <ActionRow
          title="刪除這個單字集"
          icon="trash"
          destructive
          disabled={!online}
          onPress={confirmDelete}
        />
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  body: { gap: 22 },
});
