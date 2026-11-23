import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { DescriptionPoints } from "@/components/ui/description-points";
import { Chip, EmptyState, Loaded, Panel, Screen } from "@/components/ui/layout";
import { barButton, SheetHeader } from "@/components/ui/sheet-header";
import { SpeakButton } from "@/components/ui/speak-button";
import type { SetContent } from "@/core/contract";
import { FAMILIARITY_LABELS } from "@/core/domain/labels";
import { errorMessage } from "@/data/api";
import { useLearning } from "@/data/learning";
import { deleteWords, starWords } from "@/data/library";
import { useOnline } from "@/data/network";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { speak } from "@/lib/speech";
import { colors, latin, radius, space, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

/** Native pull-down FormSheet showing one word's senses, familiarity, notes, and examples. */
export default function WordDetailSheet() {
  const { setId = "", wordId = "" } = useLocalSearchParams<{ setId: string; wordId: string }>();
  const content = useSet(setId);

  return (
    <Loaded query={content}>
      {(data) => <WordSheetBody content={data} wordId={wordId} />}
    </Loaded>
  );
}

function WordSheetBody({ content, wordId }: { content: SetContent; wordId: string }) {
  const setId = content.set.id;
  const word = content.words.find((entry) => entry.id === wordId);
  const online = useOnline();
  const { learning } = useLearning();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  if (!word) {
    return (
      <>
        <SheetHeader title="找不到單字" />
        <Screen>
          <EmptyState icon="questionmark.circle" title="找不到這個單字" />
        </Screen>
      </>
    );
  }

  const relatedQuestions = content.questions.filter((question) =>
    ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some(
      (id) => word.senses.some((sense) => sense.id === id),
    ),
  ).length;

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      `刪除「${word.word}」？`,
      relatedQuestions ? `用到它的 ${relatedQuestions} 題也會一起刪除。` : undefined,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            deleteWords(setId, [word.id])
              .then(() => {
                haptics.success();
                router.back();
              })
              .catch((reason) => {
                haptics.error();
                toast.error(errorMessage(reason));
                setDeleting(false);
              });
          },
        },
      ],
    );
  };

  return (
    <>
      <SheetHeader
        title={word.word}
        items={[
          barButton(`朗讀 ${word.word}`, "speaker.wave.2", () => speak(word.word)),
          barButton(
            word.starred ? `取消標星 ${word.word}` : `標星 ${word.word}`,
            word.starred ? "star.fill" : "star",
            () => {
              starWords(setId, [word.id], !word.starred).catch((reason) => {
                haptics.error();
                toast.error(errorMessage(reason));
              });
            },
            { tintColor: word.starred ? colors.highlight : colors.ink },
          ),
        ]}
      />

      <Screen contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {word.senses.map((sense) => {
          const progress = learning.senses[sense.id];
          return (
            <Panel key={sense.id}>
              <View style={styles.senseHead}>
                <Chip label={sense.pos} latinFont />
                <Text style={styles.meaning}>{sense.meaning}</Text>
                {sense.supplementary ? <Chip label="補充" tone="info" /> : null}
              </View>
              <Text style={styles.familiarity}>
                {progress
                  ? `${FAMILIARITY_LABELS[progress.level]} · 答對 ${progress.correct}/${progress.answered}`
                  : FAMILIARITY_LABELS[0]}
              </Text>
              <DescriptionPoints description={sense.description} />
              {sense.examples.length > 0 ? (
                <View style={styles.examples}>
                  {sense.examples.map((example, index) => (
                    <View key={index} style={styles.exampleBox}>
                      <Text style={styles.exampleText}>{example}</Text>
                      <SpeakButton text={example} compact size={16} />
                    </View>
                  ))}
                </View>
              ) : null}
            </Panel>
          );
        })}
      </Screen>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          label="刪除"
          icon="trash"
          variant="danger"
          disabled={!online}
          busy={deleting}
          onPress={confirmDelete}
          style={styles.deleteBtn}
        />
        <Button
          label="編輯"
          icon="pencil"
          variant="primary"
          disabled={!online}
          onPress={() => {
            router.replace({
              pathname: "/sets/[setId]/words/[wordId]/edit",
              params: { setId, wordId: word.id },
            });
          }}
          style={styles.editBtn}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  senseHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  meaning: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
  },
  familiarity: {
    ...type.hint,
    color: colors.inkFaint,
  },
  examples: {
    gap: 8,
    marginTop: 4,
  },
  exampleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
  },
  exampleText: {
    ...latin.medium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    flex: 1,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: space.gutter,
    paddingTop: 10,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  deleteBtn: { flex: 0.85 },
  editBtn: { flex: 1.35 },
});
