import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { moveItem } from "@/components/library/folder-actions";
import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-bar";
import { Chip, EmptyState, Loaded, Screen } from "@/components/ui/layout";
import {
  CheckRow,
  ListGroup,
  ListRow,
} from "@/components/ui/list";
import { PressableScale } from "@/components/ui/pressable-scale";
import { barButton, barMenu } from "@/components/ui/sheet-header";
import { Segmented } from "@/components/ui/segmented";
import {
  SwipeableWordRow,
  meaningLine,
} from "@/components/ui/swipeable-word-row";
import type { Question, SetContent } from "@/core/contract";
import { KIND_LABELS } from "@/core/domain/labels";
import { errorMessage } from "@/data/api";
import { deleteWords, starWords } from "@/data/library";
import { useOnline } from "@/data/network";
import { usePrefs, useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, space, type } from "@/lib/theme";
import { syncStorage } from "@/platform/install";
import { toast } from "@/platform/toast";

type Tab = "words" | "questions";
const STARRED_FIRST_KEY = "lexiro:starredFirst";
/** Rows mounted at first, and added each time the list nears its end. */
const FIRST_ROWS = 40;
const MORE_ROWS = 80;

export default function SetDetailScreen() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const content = useSet(setId);
  const [tab, setTab] = useState<Tab>("words");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [rows, setRows] = useState(FIRST_ROWS);
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const name = content.data?.set.name ?? "單字集";
  const total = content.data?.words.length ?? 0;

  const search = (text: string) => {
    setQuery(text);
    setRows(FIRST_ROWS);
  };

  const onScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    const nearEnd =
      contentOffset.y + layoutMeasurement.height >
      contentSize.height - layoutMeasurement.height;
    if (nearEnd && rows < total) setRows((count) => count + MORE_ROWS);
  };

  const deleteSelected = () => {
    const ids = [...(selected ?? [])];
    if (!ids.length) return;
    haptics.warning();
    Alert.alert(
      `刪除 ${ids.length} 個單字？`,
      "用到這些單字的題目也會一起刪除。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            deleteWords(setId, ids)
              .then(({ removedQuestionIds }) => {
                haptics.success();
                toast.success(
                  removedQuestionIds.length
                    ? `已刪除，另移除 ${removedQuestionIds.length} 題`
                    : "已刪除",
                );
                setSelected(null);
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

  // A fragment, not a wrapping View: the large title collapses only when the
  // scroll view is the screen's first native child.
  return (
    <>
      <Stack.Screen
        options={{
          title: name,
          // Always mounted: adding the search bar after the first layout leaves
          // the scroll inset short and the large title over the list.
          headerSearchBarOptions: {
            placeholder: "搜尋英文或中文",
            onChangeText: (event) => search(event.nativeEvent.text),
            onCancelButtonPress: () => search(""),
          },
          unstable_headerRightItems: () =>
            content.data
              ? [
                  barMenu("更多動作", "ellipsis", [
                    {
                      label: "單字卡",
                      symbol: "rectangle.on.rectangle.angled",
                      onPress: () =>
                        router.push({ pathname: "/sets/[setId]/cards", params: { setId } }),
                    },
                    {
                      label: "移動…",
                      symbol: "folder",
                      disabled: !online,
                      onPress: () => moveItem({ set: setId }),
                    },
                    {
                      label: "分享單字集",
                      symbol: "square.and.arrow.up",
                      onPress: () =>
                        router.push({ pathname: "/sets/[setId]/share", params: { setId } }),
                    },
                    {
                      label: "單字集設定",
                      symbol: "gearshape",
                      onPress: () =>
                        router.push({ pathname: "/sets/[setId]/settings", params: { setId } }),
                    },
                  ]),
                  barButton("新增單字", "plus", () =>
                    router.push({ pathname: "/sets/[setId]/add", params: { setId } }),
                  ),
                ]
              : [],
        }}
      />

      <Screen
        refreshControl={<SyncRefreshControl />}
        contentContainerStyle={{ paddingBottom: 112 }}
        onScroll={tab === "words" ? onScroll : undefined}
        scrollEventThrottle={100}
      >
        <Loaded query={content}>
          {(data) => (
            <SetBody
              content={data}
              tab={tab}
              onTab={(next) => {
                setTab(next);
                setSelected(null);
                setRows(FIRST_ROWS);
              }}
              query={query}
              rows={rows}
              selected={selected}
              onSelected={setSelected}
            />
          )}
        </Loaded>
      </Screen>

      {/* Bottom Floating Liquid Glass Action Dock */}
      {content.data && content.data.words.length > 0 ? (
        <View
          style={[
            styles.floatingWrap,
            { bottom: Math.max(insets.bottom, 12) + 8 },
          ]}
          pointerEvents="box-none"
        >
          {selected ? (
            <GlassSurface style={styles.selectionBar}>
              <Text style={styles.selectionCount}>
                已選 <Text style={latin.bold}>{selected.size}</Text> 個
              </Text>
              <Button
                label="複製到…"
                icon="doc.on.doc"
                size="sm"
                variant="secondary"
                disabled={!selected.size || !online}
                onPress={() => {
                  router.push({
                    pathname: "/sets/[setId]/copy",
                    params: { setId, ids: [...selected].join(",") },
                  });
                  setSelected(null);
                }}
              />
              <Button
                label="刪除"
                icon="trash"
                size="sm"
                variant="danger"
                disabled={!selected.size || !online}
                onPress={deleteSelected}
              />
            </GlassSurface>
          ) : (
            <GlassSurface style={styles.practiceDock}>
              <Button
                label="練習這組"
                icon="play.fill"
                size="lg"
                variant="primary"
                haptic="confirm"
                onPress={() =>
                  router.push({ pathname: "/practice", params: { set: setId } })
                }
                style={styles.practiceBtn}
              />
            </GlassSurface>
          )}
        </View>
      ) : null}
    </>
  );
}

function SetBody({
  content,
  tab,
  onTab,
  query,
  rows,
  selected,
  onSelected,
}: {
  content: SetContent;
  tab: Tab;
  onTab: (tab: Tab) => void;
  query: string;
  rows: number;
  selected: Set<string> | null;
  onSelected: (next: Set<string> | null) => void;
}) {
  if (!content.words.length) {
    return (
      <EmptyState
        icon="text.badge.plus"
        title="這個單字集還沒有單字"
        description="一次加一個，或貼上一整份清單。也可以請 Agent 幫你加。"
        action={
          <Button
            label="新增單字"
            icon="plus"
            onPress={() =>
              router.push({
                pathname: "/sets/[setId]/add",
                params: { setId: content.set.id },
              })
            }
          />
        }
      />
    );
  }

  return (
    <View style={styles.body}>
      <Segmented
        value={tab}
        onChange={onTab}
        options={[
          { value: "words", label: `單字 ${content.words.length}` },
          { value: "questions", label: `題目 ${content.questions.length}` },
        ]}
      />
      {tab === "words" ? (
        <WordList
          content={content}
          query={query}
          rows={rows}
          selected={selected}
          onSelected={onSelected}
        />
      ) : (
        <QuestionList content={content} query={query} />
      )}
    </View>
  );
}

function WordList({
  content,
  query,
  rows,
  selected,
  onSelected,
}: {
  content: SetContent;
  query: string;
  rows: number;
  selected: Set<string> | null;
  onSelected: (next: Set<string> | null) => void;
}) {
  const setId = content.set.id;
  const online = useOnline();
  const showMeanings = usePrefs().data?.showMeanings ?? true;
  const [starredFirst, setStarredFirstState] = useState(
    () => syncStorage.getItem(STARRED_FIRST_KEY) === "1",
  );

  const toggleStarredFirst = () => {
    const next = !starredFirst;
    haptics.select();
    setStarredFirstState(next);
    syncStorage.setItem(STARRED_FIRST_KEY, next ? "1" : "0");
  };

  const words = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return content.words.filter(
      (word) =>
        !needle ||
        word.word.toLocaleLowerCase().includes(needle) ||
        word.senses.some((sense) => sense.meaning.includes(needle)),
    );
  }, [content.words, query]);

  const starredCount = useMemo(
    () => content.words.filter((word) => word.starred).length,
    [content.words],
  );
  const lifted = starredFirst && starredCount > 0 && !selected;
  const allTop = lifted ? words.filter((word) => word.starred) : [];
  const allRest = lifted ? words.filter((word) => !word.starred) : words;
  // Only the first `rows` rows mount; the screen raises `rows` as it scrolls.
  const top = allTop.slice(0, rows);
  const rest = allRest.slice(0, Math.max(0, rows - top.length));

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelected(next);
  };

  const confirmDeleteOne = (wordId: string, label: string) => {
    Alert.alert(`刪除「${label}」？`, "用到這個單字的題目也會一起刪除。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          deleteWords(setId, [wordId])
            .then(() => {
              haptics.success();
              toast.success("已刪除");
            })
            .catch((reason) => {
              haptics.error();
              toast.error(errorMessage(reason));
            });
        },
      },
    ]);
  };

  const renderWord = (word: SetContent["words"][number]) =>
    selected ? (
      <CheckRow
        key={word.id}
        title={word.word}
        subtitle={showMeanings ? meaningLine(word) : undefined}
        checked={selected.has(word.id)}
        onPress={() => toggleSelect(word.id)}
      />
    ) : (
      <SwipeableWordRow
        key={word.id}
        setId={setId}
        word={word}
        showMeanings={showMeanings}
        online={online}
        onPress={() =>
          router.push({
            pathname: "/sets/[setId]/words/[wordId]",
            params: { setId, wordId: word.id },
          })
        }
        onToggleStar={() => {
          starWords(setId, [word.id], !word.starred).catch((reason) => {
            haptics.error();
            toast.error(errorMessage(reason));
          });
        }}
        onDelete={() => confirmDeleteOne(word.id, word.word)}
      />
    );

  return (
    <View style={styles.wordSection}>
      {/* Compact Toolbar: Starred-first + Multi-select */}
      <View style={styles.toolbar}>
        {starredCount > 0 ? (
          <PressableScale
            scaleTo={0.95}
            onPress={toggleStarredFirst}
            style={[styles.toolChip, starredFirst && styles.toolChipStarred]}
          >
            <SymbolView
              name={starredFirst ? "star.fill" : "star"}
              size={14}
              weight="semibold"
              tintColor={starredFirst ? colors.highlight : colors.inkMuted}
            />
            <Text
              style={[
                styles.toolChipText,
                starredFirst && { color: colors.highlight },
              ]}
            >
              標星置頂 <Text style={latin.semibold}>{starredCount}</Text>
            </Text>
          </PressableScale>
        ) : (
          <View />
        )}

        <View style={styles.toolGroup}>
          {!selected ? (
            <PressableScale
              scaleTo={0.95}
              onPress={() => {
                haptics.select();
                router.push({
                  pathname: "/sets/[setId]/cards",
                  params: { setId },
                });
              }}
              style={styles.toolChip}
            >
              <SymbolView
                name="rectangle.on.rectangle.angled"
                size={14}
                weight="semibold"
                tintColor={colors.inkMuted}
              />
              <Text style={styles.toolChipText}>單字卡</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            scaleTo={0.95}
            disabled={!online}
            onPress={() => {
              haptics.select();
              onSelected(selected ? null : new Set());
            }}
            style={[
              styles.toolChip,
              selected && styles.toolChipActive,
              !online && styles.disabled,
            ]}
          >
            <SymbolView
              name={selected ? "xmark" : "checklist"}
              size={14}
              weight="semibold"
              tintColor={selected ? colors.canvas : colors.inkMuted}
            />
            <Text
              style={[
                styles.toolChipText,
                selected && { color: colors.canvas },
              ]}
            >
              {selected ? "結束選取" : "多選"}
            </Text>
          </PressableScale>
        </View>
      </View>

      {words.length === 0 ? (
        <Text style={styles.emptySearch}>沒有符合的單字</Text>
      ) : (
        <>
          {top.length > 0 ? (
            <ListGroup title={`標星 · ${allTop.length}`}>
              {top.map(renderWord)}
            </ListGroup>
          ) : null}
          {rest.length > 0 ? (
            <ListGroup
              title={allTop.length > 0 ? `其他 · ${allRest.length}` : undefined}
            >
              {rest.map(renderWord)}
            </ListGroup>
          ) : null}
        </>
      )}
    </View>
  );
}

function questionPreview(question: Question): string {
  if (question.kind === "custom")
    return `${question.label}：${question.items[0].prompt}`.slice(0, 90);
  if ("items" in question) {
    return (
      question.title ||
      question.passage.replace(/__(\d+)__/g, "（$1）").slice(0, 90)
    );
  }
  return question.prompt;
}

function QuestionList({
  content,
  query,
}: {
  content: SetContent;
  query: string;
}) {
  if (!content.questions.length) {
    return (
      <EmptyState
        icon="sparkles"
        title="還沒有題目"
        description="題目由 Agent 依你的單字產生。到「我 › Agent 連線」連接 Claude 等助理，請它幫這個單字集出題。"
      />
    );
  }

  const groups = new Map<string, Question[]>();
  const needle = query.trim().toLocaleLowerCase();
  const matches = content.questions.filter(
    (question) =>
      !needle || questionPreview(question).toLocaleLowerCase().includes(needle),
  );
  if (!matches.length)
    return <Text style={styles.emptySearch}>沒有符合的題目</Text>;
  for (const question of matches) {
    groups.set(question.kind, [...(groups.get(question.kind) ?? []), question]);
  }

  return (
    <View style={styles.questionGroups}>
      {[...groups].map(([kind, questions]) => (
        <ListGroup
          key={kind}
          title={`${KIND_LABELS[kind as Question["kind"]]} · ${questions.length}`}
        >
          {questions.map((question) => (
            <ListRow
              key={question.id}
              title={questionPreview(question)}
              latinTitle
              subtitle={
                "items" in question
                  ? `${question.items.length} 小題`
                  : undefined
              }
              accessory={<Chip label={`難度 ${question.difficulty}`} />}
              chevron
              onPress={() =>
                router.push({
                  pathname: "/sets/[setId]/questions/[questionId]",
                  params: { setId: content.set.id, questionId: question.id },
                })
              }
            />
          ))}
        </ListGroup>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  wordSection: { gap: 12 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolGroup: { flexDirection: "row", gap: 8 },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  toolChipStarred: {
    backgroundColor: colors.highlightSoft,
  },
  toolChipActive: {
    backgroundColor: colors.ink,
  },
  toolChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkMuted,
  },
  disabled: { opacity: 0.45 },
  emptySearch: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
    paddingVertical: 28,
  },
  questionGroups: { gap: 16 },
  floatingWrap: {
    position: "absolute",
    left: space.gutter,
    right: space.gutter,
    alignItems: "center",
  },
  practiceDock: {
    padding: 6,
    width: "100%",
    maxWidth: 420,
  },
  practiceBtn: {
    width: "100%",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    width: "100%",
    maxWidth: 480,
  },
  selectionCount: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
});
