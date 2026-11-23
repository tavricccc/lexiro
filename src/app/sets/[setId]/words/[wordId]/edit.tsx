import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  WordEditor,
  draftInput,
  draftOf,
  draftProblem,
  type WordDraft,
} from "@/components/library/word-editor";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-bar";
import { EmptyState, KeyboardScreen, Loaded } from "@/components/ui/layout";
import { SheetHeader } from "@/components/ui/sheet-header";
import type { SetContent } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { putWords } from "@/data/library";
import { useOnline } from "@/data/network";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, space, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

export default function WordEditScreen() {
  const { setId = "", wordId = "" } = useLocalSearchParams<{ setId: string; wordId: string }>();
  const content = useSet(setId);

  return (
    <View style={styles.root}>
      <Loaded query={content}>
        {(data) => <EditorBody content={data} wordId={wordId} />}
      </Loaded>
    </View>
  );
}

function EditorBody({ content, wordId }: { content: SetContent; wordId: string }) {
  const word = content.words.find((entry) => entry.id === wordId);
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<WordDraft | null>(word ? draftOf(word) : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!word || !draft) {
    return (
      <View style={styles.root}>
        <SheetHeader title="找不到單字" />
        <KeyboardScreen>
          <EmptyState icon="questionmark.circle" title="找不到這個單字" />
        </KeyboardScreen>
      </View>
    );
  }

  const removed = word.senses.filter(
    (sense) => !draft.senses.some((entry) => entry.id === sense.id),
  ).length;

  const submit = async () => {
    const problem = draftProblem(draft);
    if (problem) {
      haptics.error();
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const { removedQuestionIds } = await putWords(content.set.id, [draftInput(draft)]);
      haptics.success();
      if (removedQuestionIds.length) {
        toast.info(`移除了用到已刪意思的 ${removedQuestionIds.length} 題`);
      } else {
        toast.success("已儲存");
      }
      router.back();
    } catch (reason) {
      haptics.error();
      setError(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SheetHeader title="編輯單字" />
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 120 }}>
        <WordEditor
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setError("");
          }}
        />
        {removed > 0 ? (
          <Text style={styles.caution}>
            刪掉的 {removed} 個意思，相關題目會一起移除。
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </KeyboardScreen>

      <KeyboardStickyView offset={{ closed: 0, opened: 8 }}>
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <GlassSurface style={styles.dock}>
            <Button
              label="取消"
              variant="ghost"
              onPress={() => router.back()}
              style={styles.cancelBtn}
            />
            <Button
              label="儲存"
              icon="checkmark"
              variant="primary"
              busy={busy}
              disabled={!online}
              haptic="confirm"
              onPress={() => void submit()}
              style={styles.saveBtn}
            />
          </GlassSurface>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  caution: { ...type.hint, color: colors.caution, paddingHorizontal: 6 },
  error: { ...type.hint, color: colors.dangerInk, paddingHorizontal: 6 },
  stickyBar: { paddingHorizontal: space.gutter, paddingTop: 8 },
  dock: { flexDirection: "row", gap: 8, padding: 6 },
  cancelBtn: { flex: 0.85 },
  saveBtn: { flex: 1.35 },
});
