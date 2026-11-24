import { SymbolView } from "expo-symbols";
import { memo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { descriptionPoints, type Word } from "@/core/contract";
import { haptics } from "@/lib/haptics";
import { colors, latin, space, type } from "@/lib/theme";
import { DescriptionPoints } from "./description-points";
import { CheckMark } from "./list";
import { PressableRow } from "./pressable-row";
import { StarButton } from "./star-button";

/** "n. 銀行；河岸 · v. 存錢" grouped by part of speech. */
/** With `supplementary` set, only the original (false) or the added (true) senses. */
export function meaningLine(word: Word, supplementary?: boolean): string {
  const groups = new Map<string, string[]>();
  for (const sense of word.senses.filter(
    (entry) =>
      supplementary === undefined || entry.supplementary === supplementary,
  )) {
    groups.set(sense.pos, [...(groups.get(sense.pos) ?? []), sense.meaning]);
  }
  return [...groups]
    .map(([pos, meanings]) => `${pos} ${meanings.join("；")}`)
    .join(" · ");
}

/**
 * Native swipeable word row:
 * - Tap: opens WordSheet
 * - Swipe right: toggles star with medium haptic feedback
 * - Swipe left: deletes word (when online)
 * With `checked` set it is being selected: a tap toggles it and swipes are off.
 * Memoized and one row for both, so a long list changes mode without remounting;
 * the handlers take the word and must be stable.
 */
export const SwipeableWordRow = memo(function SwipeableWordRow({
  setId,
  word,
  showMeanings = true,
  online = true,
  checked,
  onPress,
  onToggleStar,
  onDelete,
}: {
  setId: string;
  word: Word;
  showMeanings?: boolean;
  online?: boolean;
  checked?: boolean;
  onPress: (word: Word) => void;
  onToggleStar: (word: Word) => void;
  onDelete?: (word: Word) => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const main = meaningLine(word, false);
  const extra = meaningLine(word, true);
  const points = word.senses.flatMap((sense) =>
    descriptionPoints(sense.description),
  );

  const renderLeftActions = () => (
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        haptics.confirm();
        onToggleStar(word);
      }}
      style={[styles.swipeAction, styles.starAction]}
    >
      <SymbolView
        name={word.starred ? "star.slash.fill" : "star.fill"}
        size={20}
        weight="semibold"
        tintColor="#ffffff"
      />
      <Text style={styles.swipeLabel}>{word.starred ? "取消" : "標星"}</Text>
    </Pressable>
  );

  const renderRightActions = () =>
    online && onDelete ? (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          haptics.warning();
          onDelete(word);
        }}
        style={[styles.swipeAction, styles.deleteAction]}
      >
        <SymbolView
          name="trash.fill"
          size={20}
          weight="semibold"
          tintColor="#ffffff"
        />
        <Text style={styles.swipeLabel}>刪除</Text>
      </Pressable>
    ) : null;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={checked === undefined}
      friction={2}
      leftThreshold={52}
      rightThreshold={52}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={online && onDelete ? renderRightActions : undefined}
      onSwipeableOpen={(direction) => {
        if (direction === "left") {
          haptics.confirm();
          onToggleStar(word);
          swipeRef.current?.close();
        }
      }}
    >
      <View style={styles.rowContainer}>
        <PressableRow
          onPress={() => {
            haptics.select();
            onPress(word);
          }}
          accessibilityState={checked === undefined ? undefined : { checked }}
          style={styles.main}
        >
          <View style={styles.textCol}>
            <Text style={styles.word} numberOfLines={1}>
              {word.word}
            </Text>
            {showMeanings && main ? (
              <Text style={styles.meaning} numberOfLines={1}>
                {main}
              </Text>
            ) : null}
            {showMeanings && extra ? (
              <View style={styles.extraRow}>
                <Text style={styles.extraTag}>補充</Text>
                <Text style={styles.meaning} numberOfLines={2}>
                  {extra}
                </Text>
              </View>
            ) : null}
            {showMeanings && points.length > 0 ? (
              <DescriptionPoints points={points} boxed compact />
            ) : null}
          </View>
          {/* Inside the row, so while selecting the check is part of one big
              target; the star is its own button and takes its own taps. */}
          <View style={styles.starWrap}>
            {checked === undefined ? (
              <StarButton
                setId={setId}
                wordId={word.id}
                starred={word.starred}
                word={word.word}
              />
            ) : (
              <View pointerEvents="none" style={styles.check}>
                <CheckMark checked={checked} />
              </View>
            )}
          </View>
        </PressableRow>
      </View>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingLeft: space.row,
  },
  textCol: {
    flex: 1,
    gap: 2,
    paddingVertical: 11,
    paddingRight: 4,
  },
  word: {
    ...latin.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  meaning: {
    ...type.hint,
    color: colors.inkMuted,
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  extraTag: {
    ...type.hint,
    fontWeight: "600",
    color: colors.inkFaint,
  },
  check: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  starWrap: {
    paddingRight: 8,
  },
  swipeAction: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  starAction: {
    backgroundColor: "#e0a12a",
  },
  deleteAction: {
    backgroundColor: "#d2445f",
  },
  swipeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
});
