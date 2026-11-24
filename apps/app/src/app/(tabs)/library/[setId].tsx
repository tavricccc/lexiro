import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import { GlassDock } from "@/components/ui/glass-dock";
import { Chip, EmptyState, Loaded, Screen } from "@/components/ui/layout";
import { ListGroup, ListRow } from "@/components/ui/list";
import { usePageReady } from "@/components/ui/use-page-ready";
import { barButton, barMenu } from "@/components/ui/sheet-header";
import { Segmented } from "@/components/ui/segmented";
import { SwipeableWordRow } from "@/components/ui/swipeable-word-row";
import type { Question, SetContent, Word } from "@/core/contract";
import { KIND_LABELS } from "@/core/domain/labels";
import { errorMessage } from "@/data/api";
import { deleteWords, starWords } from "@/data/library";
import { useOnline } from "@/data/network";
import { usePrefs, useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, space, type } from "@/lib/theme";
import { syncStorage } from "@/platform/install";
import { toast } from "@/platform/toast";

type Tab = "words" | "questions";
const STARRED_FIRST_KEY = "lexiro:starredFirst";
/** Rows mounted while the page is pushed in: a screenful. */
const PUSH_ROWS = 12;
/** Rows mounted at first, and added each time the list nears its end. */
const FIRST_ROWS = 40;
const MORE_ROWS = 80;

export default function SetDetailScreen() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const content = useSet(setId);
  const [tab, setTab] = useState<Tab>("words");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [limit, setRows] = useState(FIRST_ROWS);
  const ready = usePageReady();
  const arrived = usePageReady("transitionEnd");
  const rows = useDeferredValue(arrived ? limit : PUSH_ROWS);
  // The dock answers at once; the list follows.
  const listSelected = useDeferredValue(selected);
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const name = content.data?.set.name ?? "單字集";
  const total = Math.max(content.data?.words.length ?? 0, content.data?.questions.length ?? 0);

  const search = (text: string) => {
    setQuery(text);
    setRows(FIRST_ROWS);
  };

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    const nearEnd =
      contentOffset.y + layoutMeasurement.height > contentSize.height - layoutMeasurement.height;
    if (nearEnd && limit < total) setRows((count) => count + MORE_ROWS);
  };

  const deleteSelected = () => {
    const ids = [...(selected ?? [])];
    if (!ids.length) return;
    haptics.warning();
    Alert.alert(`刪除 ${ids.length} 個單字？`, "用到這些單字的題目也會一起刪除。", [
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
    ]);
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
        onScroll={onScroll}
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
              selected={listSelected}
              selecting={!!selected}
              onSelected={setSelected}
            />
          )}
        </Loaded>
      </Screen>

      {/* Bottom Floating Liquid Glass Action Dock */}
      {ready && content.data && content.data.words.length > 0 ? (
        <View
          style={[styles.floatingWrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
          pointerEvents="box-none"
        >
          <GlassDock
            expanded={!!selected}
            style={styles.dock}
            actions={
              selected
                ? [
                    {
                      id: "copy",
                      shape: "main",
                      label: selected.size ? `複製 ${selected.size} 個` : "複製",
                      icon: "doc.on.doc",
                      variant: "secondary",
                      disabled: !selected.size || !online,
                      onPress: () => {
                        router.push({
                          pathname: "/sets/[setId]/copy",
                          params: { setId, ids: [...selected].join(",") },
                        });
                        setSelected(null);
                      },
                    },
                    {
                      id: "delete",
                      shape: "second",
                      label: selected.size ? `刪除 ${selected.size} 個` : "刪除",
                      icon: "trash",
                      variant: "danger",
                      haptic: "none",
                      disabled: !selected.size || !online,
                      onPress: deleteSelected,
                    },
                  ]
                : [
                    {
                      id: "practice",
                      shape: "main",
                      label: "練習這組",
                      icon: "play.fill",
                      haptic: "confirm",
                      onPress: () => router.push({ pathname: "/practice", params: { set: setId } }),
                    },
                  ]
            }
          />
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
  selecting,
  onSelected,
}: {
  content: SetContent;
  tab: Tab;
  onTab: (tab: Tab) => void;
  query: string;
  rows: number;
  selected: Set<string> | null;
  /** Ahead of `selected`, which follows when the rows have changed. */
  selecting: boolean;
  onSelected: Dispatch<SetStateAction<Set<string> | null>>;
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
          selecting={selecting}
          onSelected={onSelected}
        />
      ) : (
        <QuestionList content={content} query={query} rows={rows} />
      )}
    </View>
  );
}

function WordList({
  content,
  query,
  rows,
  selected,
  selecting,
  onSelected,
}: {
  content: SetContent;
  query: string;
  rows: number;
  selected: Set<string> | null;
  /** Ahead of `selected`, which follows when the rows have changed. */
  selecting: boolean;
  onSelected: Dispatch<SetStateAction<Set<string> | null>>;
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

  const picking = selected !== null;
  const pressWord = useCallback(
    (word: Word) => {
      if (!picking) {
        router.push({
          pathname: "/sets/[setId]/words/[wordId]",
          params: { setId, wordId: word.id },
        });
        return;
      }
      onSelected((current) => {
        if (!current) return current;
        const next = new Set(current);
        if (!next.delete(word.id)) next.add(word.id);
        return next;
      });
    },
    [picking, setId, onSelected],
  );

  const toggleStar = useCallback(
    (word: Word) => {
      starWords(setId, [word.id], !word.starred).catch((reason) => {
        haptics.error();
        toast.error(errorMessage(reason));
      });
    },
    [setId],
  );

  const confirmDeleteOne = useCallback(
    (word: Word) => {
      Alert.alert(`刪除「${word.word}」？`, "用到這個單字的題目也會一起刪除。", [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => {
            deleteWords(setId, [word.id])
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
    },
    [setId],
  );

  const renderWord = (word: Word) => (
    <SwipeableWordRow
      key={word.id}
      setId={setId}
      word={word}
      showMeanings={showMeanings}
      online={online}
      checked={selected?.has(word.id)}
      onPress={pressWord}
      onToggleStar={toggleStar}
      onDelete={confirmDeleteOne}
    />
  );

  return (
    <View style={styles.wordSection}>
      {/* Compact Toolbar: Starred-first + Multi-select */}
      <View style={styles.toolbar}>
        {starredCount > 0 ? (
          <Button
            label={`標星置頂 ${starredCount}`}
            icon={starredFirst ? "star.fill" : "star"}
            size="sm"
            variant={starredFirst ? "accent" : "ghost"}
            haptic="none"
            onPress={toggleStarredFirst}
          />
        ) : (
          <View />
        )}

        <GlassDock
          expanded={!selecting}
          size="sm"
          fill={false}
          style={styles.toolGroup}
          actions={
            selecting
              ? [
                  {
                    id: "done",
                    shape: "select",
                    label: "結束選取",
                    icon: "xmark",
                    variant: "accent",
                    onPress: () => onSelected(null),
                  },
                ]
              : [
                  {
                    id: "cards",
                    shape: "cards",
                    label: "單字卡",
                    icon: "rectangle.on.rectangle.angled",
                    variant: "ghost",
                    onPress: () =>
                      router.push({ pathname: "/sets/[setId]/cards", params: { setId } }),
                  },
                  {
                    id: "select",
                    shape: "select",
                    label: "多選",
                    icon: "checklist",
                    variant: "ghost",
                    disabled: !online,
                    onPress: () => onSelected(new Set()),
                  },
                ]
          }
        />
      </View>

      {words.length === 0 ? (
        <Text style={styles.emptySearch}>沒有符合的單字</Text>
      ) : (
        <>
          {top.length > 0 ? (
            <ListGroup title={`標星 · ${allTop.length}`}>{top.map(renderWord)}</ListGroup>
          ) : null}
          {rest.length > 0 ? (
            <ListGroup title={allTop.length > 0 ? `其他 · ${allRest.length}` : undefined}>
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
    return question.title || question.passage.replace(/__(\d+)__/g, "（$1）").slice(0, 90);
  }
  return question.prompt;
}

function QuestionList({
  content,
  query,
  rows,
}: {
  content: SetContent;
  query: string;
  rows: number;
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
    (question) => !needle || questionPreview(question).toLocaleLowerCase().includes(needle),
  );
  if (!matches.length) return <Text style={styles.emptySearch}>沒有符合的題目</Text>;
  for (const question of matches) {
    groups.set(question.kind, [...(groups.get(question.kind) ?? []), question]);
  }

  // Only the first `rows` rows mount; the screen raises `rows` as it scrolls.
  let left = rows;
  const shown = [...groups].flatMap(([kind, all]) => {
    const questions = all.slice(0, left);
    left -= questions.length;
    return questions.length ? [{ kind, total: all.length, questions }] : [];
  });

  return (
    <View style={styles.questionGroups}>
      {shown.map(({ kind, total, questions }) => (
        <ListGroup
          key={kind}
          title={`${KIND_LABELS[kind as Question["kind"]]} · ${total}`}
        >
          {questions.map((question) => (
            <ListRow
              key={question.id}
              title={questionPreview(question)}
              latinTitle
              subtitle={"items" in question ? `${question.items.length} 小題` : undefined}
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
  toolGroup: { flex: 1 },
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
  dock: {
    width: "100%",
    maxWidth: 480,
  },
});
