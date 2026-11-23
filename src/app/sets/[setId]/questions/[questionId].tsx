import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Chip, EmptyState, Loaded, Panel, Screen } from "@/components/ui/layout";
import {
  itemOptions,
  type CustomItem,
  type CustomQuestion,
  type Question,
  type SetContent,
} from "@/core/contract";
import { KIND_LABELS } from "@/core/domain/labels";
import { passageParts } from "@/core/domain/practice";
import { barButton } from "@/components/ui/sheet-header";
import { errorMessage } from "@/data/api";
import { deleteQuestions } from "@/data/library";
import { useOnline } from "@/data/network";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, type } from "@/lib/theme";
import { toast } from "@/platform/toast";

const DIFFICULTY = ["", "簡單", "中等", "困難"];

export default function QuestionPreviewScreen() {
  const { setId = "", questionId = "" } = useLocalSearchParams<{
    setId: string;
    questionId: string;
  }>();
  const content = useSet(setId);
  const online = useOnline();
  const [deleting, setDeleting] = useState(false);

  const question = content.data?.questions.find((entry) => entry.id === questionId);
  const title = question
    ? question.kind === "custom"
      ? question.label
      : KIND_LABELS[question.kind]
    : "題目";

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert("刪除這一題？", "這一題會從單字集移除。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          setDeleting(true);
          deleteQuestions(setId, [questionId])
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
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title,
          unstable_headerRightItems: () =>
            question
              ? [
                  barButton("刪除這一題", "trash", confirmDelete, {
                    disabled: !online || deleting,
                    tintColor: colors.danger,
                  }),
                ]
              : [],
        }}
      />
      <Screen>
        <Loaded query={content}>
          {(data) =>
            question ? (
              <View style={styles.body}>
                <Chip label={`${DIFFICULTY[question.difficulty]}難度`} />
                <QuestionBody content={data} question={question} />
              </View>
            ) : (
              <EmptyState
                icon="questionmark.circle"
                title="找不到這一題"
                description="可能已經被刪除了。"
              />
            )
          }
        </Loaded>
      </Screen>
    </>
  );
}

function OptionsPreview({
  options,
  answer,
  whyWrong,
}: {
  options: string[];
  answer: number | number[];
  whyWrong?: Record<string, string>;
}) {
  const isRight = (index: number) =>
    Array.isArray(answer) ? answer.includes(index) : index === answer;
  return (
    <View style={styles.optionList}>
      {options.map((option, index) => {
        const right = isRight(index);
        return (
          <View key={index} style={[styles.optionRow, right && styles.optionRight]}>
            <View style={styles.optionTop}>
              <Text style={styles.optionNum}>{index + 1}</Text>
              <Text style={[styles.optionText, right && styles.optionTextRight]}>{option}</Text>
              {right ? (
                <SymbolView name="checkmark" size={15} weight="bold" tintColor={colors.positiveInk} />
              ) : null}
            </View>
            {whyWrong?.[option] ? (
              <Text style={styles.whyWrong}>{whyWrong[option]}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function CustomAnswerPreview({ item }: { item: CustomItem }) {
  switch (item.mode) {
    case "single":
      return <OptionsPreview options={item.options} answer={item.answer} whyWrong={item.whyWrong} />;
    case "multiple":
      return (
        <OptionsPreview options={item.options} answer={item.answers} whyWrong={item.whyWrong} />
      );
    case "input":
      return (
        <View style={styles.chipWrap}>
          {item.accepted.map((answer) => (
            <Chip key={answer} label={answer} tone="positive" latinFont />
          ))}
        </View>
      );
    case "order":
      return (
        <View style={styles.optionList}>
          {item.pieces.map((piece, index) => (
            <View key={index} style={styles.optionRow}>
              <View style={styles.optionTop}>
                <Text style={styles.optionNum}>{index + 1}</Text>
                <Text style={styles.optionText}>{piece}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    case "match":
      return (
        <View style={styles.optionList}>
          {item.pairs.map(([left, right], index) => (
            <View key={index} style={[styles.optionRow, styles.matchRow]}>
              <Text style={styles.matchText}>{left}</Text>
              <Text style={styles.matchArrow}>→</Text>
              <Text style={styles.matchText}>{right}</Text>
            </View>
          ))}
        </View>
      );
  }
}

function CustomPreview({
  question,
  words,
}: {
  question: CustomQuestion;
  words: Map<string, string>;
}) {
  return (
    <>
      {question.instructions || question.passage ? (
        <Panel>
          {question.instructions ? <Text style={styles.muted}>{question.instructions}</Text> : null}
          {question.passage ? <Text style={styles.passage}>{question.passage}</Text> : null}
        </Panel>
      ) : null}
      {question.items.map((item, index) => (
        <Panel key={item.id}>
          {question.items.length > 1 ? (
            <Text style={styles.subLabel}>第 {index + 1} 題</Text>
          ) : null}
          <Text style={styles.prompt}>{item.prompt}</Text>
          <CustomAnswerPreview item={item} />
          <Text style={styles.senseMeta}>練習字義：{words.get(item.senseId)}</Text>
          {item.explanation ? <Text style={styles.explanation}>{item.explanation}</Text> : null}
        </Panel>
      ))}
      {question.explanation ? (
        <Panel>
          <Text style={styles.explanation}>{question.explanation}</Text>
        </Panel>
      ) : null}
    </>
  );
}

function QuestionBody({ question, content }: { question: Question; content: SetContent }) {
  const words = new Map(
    content.words.flatMap((word) =>
      word.senses.map((sense) => [sense.id, `${word.word} ${sense.pos} ${sense.meaning}`] as const),
    ),
  );

  if (question.kind === "custom") return <CustomPreview question={question} words={words} />;

  if (question.kind === "vocabulary") {
    return (
      <Panel>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <OptionsPreview
          options={question.options}
          answer={question.answer}
          whyWrong={question.whyWrong}
        />
        <Text style={styles.senseMeta}>練習字義：{words.get(question.senseId)}</Text>
        {question.explanation ? (
          <Text style={styles.explanation}>{question.explanation}</Text>
        ) : null}
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        {question.title ? <Text style={styles.passageTitle}>{question.title}</Text> : null}
        <Text style={styles.passage}>
          {passageParts(question.passage).map((part, index) =>
            typeof part === "string" ? (
              part
            ) : (
              <Text key={index} style={styles.blankTag}>
                {` (${part}) `}
              </Text>
            ),
          )}
        </Text>
        {question.bank?.length ? (
          <View style={styles.chipWrap}>
            {question.bank.map((option) => (
              <Chip key={option} label={option} latinFont />
            ))}
          </View>
        ) : null}
      </Panel>

      {question.items.map((item, index) => (
        <Panel key={item.id}>
          <Text style={styles.subLabel}>
            {item.blank ? `第 ${item.blank} 格` : `第 ${index + 1} 題`}
          </Text>
          {item.prompt ? <Text style={styles.prompt}>{item.prompt}</Text> : null}
          <OptionsPreview
            options={itemOptions(question, item)}
            answer={item.answer}
            whyWrong={item.whyWrong}
          />
          <Text style={styles.senseMeta}>練習字義：{words.get(item.senseId)}</Text>
          {item.explanation ? <Text style={styles.explanation}>{item.explanation}</Text> : null}
        </Panel>
      ))}

      {question.explanation ? (
        <Panel>
          <Text style={styles.explanation}>{question.explanation}</Text>
        </Panel>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  subLabel: { ...type.hint, fontWeight: "600", color: colors.inkMuted },
  prompt: { ...latin.semibold, fontSize: 17, lineHeight: 25, color: colors.ink },
  passageTitle: { ...latin.bold, fontSize: 18, color: colors.ink },
  passage: { ...latin.medium, fontSize: 16, lineHeight: 28, color: colors.ink },
  blankTag: { ...latin.bold, color: colors.accentInk },
  muted: { ...type.body, color: colors.inkMuted },
  explanation: { ...type.body, color: colors.inkMuted },
  senseMeta: { ...type.hint, color: colors.inkMuted },
  optionList: { gap: 8 },
  optionRow: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  optionRight: { backgroundColor: colors.positiveSoft },
  optionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionNum: {
    ...latin.semibold,
    width: 18,
    fontSize: 14,
    color: colors.inkMuted,
  },
  optionText: {
    ...latin.medium,
    fontSize: 15,
    color: colors.ink,
    flex: 1,
  },
  optionTextRight: {
    ...latin.semibold,
    color: colors.positiveInk,
  },
  whyWrong: {
    ...type.hint,
    color: colors.inkMuted,
    paddingLeft: 28,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matchText: { ...latin.medium, fontSize: 14, color: colors.ink, flex: 1 },
  matchArrow: { color: colors.inkFaint },
});
