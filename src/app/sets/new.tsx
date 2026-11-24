import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openSet } from "@/components/library/folder-actions";
import { SetForm, type SetFormValue } from "@/components/library/set-form";
import { Button } from "@/components/ui/button";
import { KeyboardScreen } from "@/components/ui/layout";
import { SheetHeader } from "@/components/ui/sheet-header";
import { errorMessage } from "@/data/api";
import { createSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { useLibrary } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, space } from "@/lib/theme";

export default function NewSetScreen() {
  const { folder } = useLocalSearchParams<{ folder?: string }>();
  const library = useLibrary();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState<SetFormValue>({
    name: "",
    folderId: folder ?? null,
    hue: "mint",
    icon: "books",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.name.trim()) {
      haptics.error();
      setError("請輸入名稱");
      return;
    }
    setBusy(true);
    try {
      const created = await createSet({ ...value, name: value.name.trim() });
      haptics.success();
      openSet(created.id);
    } catch (reason) {
      haptics.error();
      setError(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SheetHeader title="新增單字集" />
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 110 }}>
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
      </KeyboardScreen>

      <KeyboardStickyView offset={{ closed: 0, opened: 8 }}>
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.dock}>
            <Button
              label="建立單字集"
              icon="checkmark"
              size="lg"
              busy={busy}
              disabled={!online}
              haptic="confirm"
              onPress={() => void submit()}
              style={styles.submitBtn}
            />
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  stickyBar: {
    paddingHorizontal: space.gutter,
    paddingTop: 8,
  },
  dock: {},
  submitBtn: { width: "100%" },
});
