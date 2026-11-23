import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  WordEditor,
  draftInput,
  draftProblem,
  emptyWord,
  type WordDraft,
} from "@/components/library/word-editor";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-bar";
import { KeyboardScreen, Loaded, Panel } from "@/components/ui/layout";
import { ListGroup, PickerRow } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import { SheetHeader } from "@/components/ui/sheet-header";
import { PARTS_OF_SPEECH, normalizeWord, type SetContent } from "@/core/contract";
import { parseBulk } from "@/core/domain/bulk";
import { errorMessage } from "@/data/api";
import { putWords } from "@/data/library";
import { useOnline } from "@/data/network";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, space, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const POS_OPTIONS = PARTS_OF_SPEECH.map((pos) => ({ value: pos, label: pos }));

export default function AddWordsScreen() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const content = useSet(setId);

  return (
    <View style={styles.root}>
      <SheetHeader title="新增單字" />
      <Loaded query={content}>{(data) => <AddWordsBody content={data} />}</Loaded>
    </View>
  );
}

function AddWordsBody({ content }: { content: SetContent }) {
  const [mode, setMode] = useState<"one" | "list">("one");
  return mode === "one" ? (
    <AddOne content={content} mode={mode} onMode={setMode} />
  ) : (
    <AddList content={content} mode={mode} onMode={setMode} />
  );
}

function AddOne({
  content,
  mode,
  onMode,
}: {
  content: SetContent;
  mode: "one" | "list";
  onMode: (next: "one" | "list") => void;
}) {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<WordDraft>(emptyWord);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = content.words.find(
    (word) => normalizeWord(word.word) === normalizeWord(draft.word),
  );

  const save = async (again: boolean) => {
    const problem = draftProblem(draft);
    if (problem) {
      haptics.error();
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await putWords(content.set.id, [draftInput(draft)]);
      haptics.success();
      toast.success(
        existing
          ? `已把新的意思加到「${existing.word}」`
          : `已加入「${draft.word.trim()}」`,
      );
      if (again) {
        setDraft(emptyWord());
        setError("");
      } else {
        router.back();
      }
    } catch (reason) {
      haptics.error();
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 120 }}>
        <Segmented
          value={mode}
          onChange={onMode}
          options={[
            { value: "one", label: "一個一個加" },
            { value: "list", label: "貼上清單" },
          ]}
        />
        <WordEditor
          key={draft.senses[0]?.key}
          draft={draft}
          autoFocus
          onChange={(next) => {
            setDraft(next);
            setError("");
          }}
        />
        {existing ? (
          <Text style={styles.infoNote}>
            這個單字集已經有「{existing.word}」，新的意思會加到它下面。
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
          <GlassSurface style={styles.actionDock}>
            <Button
              label="儲存返回"
              variant="ghost"
              disabled={!online || busy}
              onPress={() => void save(false)}
              style={styles.halfBtn}
            />
            <Button
              label="儲存，再加一個"
              icon="plus"
              variant="primary"
              busy={busy}
              disabled={!online}
              haptic="confirm"
              onPress={() => void save(true)}
              style={styles.primaryHalfBtn}
            />
          </GlassSurface>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function AddList({
  content,
  mode,
  onMode,
}: {
  content: SetContent;
  mode: "one" | "list";
  onMode: (next: "one" | "list") => void;
}) {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [pos, setPos] = useState("n.");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseBulk(text, pos), [text, pos]);
  const known = useMemo(
    () => new Set(content.words.map((word) => normalizeWord(word.word))),
    [content.words],
  );
  const fresh = parsed.words.filter((word) => !known.has(normalizeWord(word.word))).length;

  const submit = async () => {
    if (!parsed.words.length || !online) return;
    setBusy(true);
    try {
      for (let at = 0; at < parsed.words.length; at += 200) {
        await putWords(content.set.id, parsed.words.slice(at, at + 200));
      }
      haptics.success();
      toast.success(`已加入 ${parsed.words.length} 個單字`);
      router.back();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 120 }}>
        <Segmented
          value={mode}
          onChange={onMode}
          options={[
            { value: "one", label: "一個一個加" },
            { value: "list", label: "貼上清單" },
          ]}
        />
        <Panel style={styles.bulkPanel}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={
              "一行一個單字，例如：\nrescue\tv.\t救援\nbank, n., 銀行；河岸\ngive up phr. v. 放棄"
            }
            placeholderTextColor={colors.inkFaint}
            textAlignVertical="top"
            style={styles.bulkInput}
          />
        </Panel>
        <ListGroup>
          <PickerRow
            title="沒寫詞性時當作"
            value={pos}
            options={POS_OPTIONS}
            onChange={setPos}
          />
        </ListGroup>

        {parsed.words.length > 0 || parsed.problems.length > 0 ? (
          <Panel>
            <Text style={styles.bulkSummary}>
              讀到 <Text style={latin.bold}>{parsed.words.length}</Text> 個單字
              {parsed.words.length - fresh > 0
                ? `，其中 ${parsed.words.length - fresh} 個已在單字集，會補上新的意思`
                : ""}
              。
            </Text>
            {parsed.problems.slice(0, 5).map((problem) => (
              <Text key={problem.line} style={styles.problemLine}>
                第 {problem.line} 行：{problem.error}（{problem.text}）
              </Text>
            ))}
            {parsed.problems.length > 5 ? (
              <Text style={styles.problemLine}>還有 {parsed.problems.length - 5} 行</Text>
            ) : null}
          </Panel>
        ) : null}
      </KeyboardScreen>

      <KeyboardStickyView offset={{ closed: 0, opened: 8 }}>
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <GlassSurface style={styles.actionDock}>
            <Button
              label={parsed.words.length ? `加入 ${parsed.words.length} 個單字` : "加入單字"}
              icon="plus"
              size="lg"
              busy={busy}
              disabled={!online || !parsed.words.length}
              haptic="confirm"
              onPress={() => void submit()}
              style={styles.fullBtn}
            />
          </GlassSurface>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  infoNote: {
    ...type.hint,
    color: colors.info,
    paddingHorizontal: 6,
  },
  error: {
    ...type.hint,
    color: colors.dangerInk,
    paddingHorizontal: 6,
  },
  stickyBar: {
    paddingHorizontal: space.gutter,
    paddingTop: 8,
  },
  actionDock: {
    flexDirection: "row",
    gap: 8,
    padding: 6,
  },
  halfBtn: { flex: 0.9 },
  primaryHalfBtn: { flex: 1.3 },
  fullBtn: { flex: 1 },
  bulkPanel: { padding: 14 },
  bulkInput: {
    ...latin.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    minHeight: 190,
  },
  bulkSummary: {
    ...type.body,
    color: colors.ink,
  },
  problemLine: {
    ...type.hint,
    color: colors.dangerInk,
  },
});
