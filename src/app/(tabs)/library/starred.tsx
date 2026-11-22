import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SyncRefreshControl } from "@/components/sync-refresh-control";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-bar";
import { EmptyState, Screen } from "@/components/ui/layout";
import { ListGroup } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import { StarButton } from "@/components/ui/star-button";
import { meaningLine } from "@/components/ui/swipeable-word-row";
import type { Word } from "@/core/contract";
import { useStarredWords } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, space, type } from "@/lib/theme";

const ALL = "all";

export default function StarredScreen() {
  const { groups, loading, count } = useStarredWords();
  const [filter, setFilter] = useState(ALL);
  const insets = useSafeAreaInsets();

  const activeFilter = groups.some((group) => group.set.id === filter) ? filter : ALL;
  const shown =
    activeFilter === ALL ? groups : groups.filter((group) => group.set.id === activeFilter);
  const total = shown.reduce((sum, group) => sum + group.words.length, 0);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "標星單字" }} />
      <Screen
        refreshControl={<SyncRefreshControl />}
        contentContainerStyle={total > 0 ? { paddingBottom: 112 } : undefined}
      >
        {loading && !groups.length ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.contrast as string} />
          </View>
        ) : !groups.length ? (
          <EmptyState
            icon="star"
            title="還沒有標星的單字"
            description="練習或瀏覽單字集時按星號，想再看一次的字都會收在這裡。"
          />
        ) : (
          <View style={styles.body}>
            <Text style={styles.summary}>
              共 <Text style={latin.semibold}>{count}</Text> 個字，來自 {groups.length} 個單字集
            </Text>

            {groups.length > 1 ? (
              <Segmented
                scrollable
                value={activeFilter}
                onChange={setFilter}
                options={[
                  { value: ALL, label: `全部 ${count}` },
                  ...groups.map((group) => ({
                    value: group.set.id,
                    label: `${group.set.name} ${group.words.length}`,
                  })),
                ]}
              />
            ) : null}

            {shown.map((group) => (
              <ListGroup
                key={group.set.id}
                title={`${group.set.name} · ${group.words.length}`}
              >
                {group.words.map((word) => (
                  <StarredWordRow key={word.id} setId={group.set.id} word={word} />
                ))}
              </ListGroup>
            ))}
          </View>
        )}
      </Screen>

      {total > 0 ? (
        <View
          style={[styles.floatingWrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
          pointerEvents="box-none"
        >
          <GlassSurface style={styles.floatingBar}>
            <Button
              label={`練習這 ${total} 個字`}
              icon="play.fill"
              variant="solid"
              size="lg"
              haptic="confirm"
              onPress={() => {
                router.push({
                  pathname: "/practice",
                  params: {
                    set: shown.map((g) => g.set.id).join(","),
                    focus: "starred",
                  },
                });
              }}
              style={styles.floatingBtn}
            />
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

function StarredWordRow({ setId, word }: { setId: string; word: Word }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptics.select();
          router.push({
            pathname: "/sets/[setId]/words/[wordId]",
            params: { setId, wordId: word.id },
          });
        }}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <Text style={styles.wordText}>{word.word}</Text>
        <Text style={styles.meaningText} numberOfLines={1}>
          {meaningLine(word)}
        </Text>
      </Pressable>
      <View style={styles.starWrap}>
        <StarButton setId={setId} wordId={word.id} starred={word.starred} word={word.word} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  loader: { paddingVertical: 48, alignItems: "center" },
  body: { gap: 14 },
  summary: {
    ...type.hint,
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowMain: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: space.row,
    paddingRight: 4,
    paddingVertical: 10,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  wordText: {
    ...latin.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  meaningText: {
    ...type.hint,
    fontSize: 14,
    color: colors.inkMuted,
    flex: 1,
    textAlign: "right",
  },
  starWrap: { paddingRight: 8 },
  floatingWrap: {
    position: "absolute",
    left: space.gutter,
    right: space.gutter,
    alignItems: "center",
  },
  floatingBar: {
    padding: 6,
    width: "100%",
    maxWidth: 420,
  },
  floatingBtn: {
    width: "100%",
  },
});
