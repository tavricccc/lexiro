import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { descriptionPoints, type Word } from "@/core/contract";
import { haptics } from "@/lib/haptics";
import { colors, latin, space, type } from "@/lib/theme";
import { DescriptionPoints } from "./description-points";
import { StarButton } from "./star-button";

/** "n. 銀行；河岸 · v. 存錢" grouped by part of speech. */
/** With `supplementary` set, only the original (false) or the added (true) senses. */
export function meaningLine(word: Word, supplementary?: boolean): string {
  const groups = new Map<string, string[]>();
  for (const sense of word.senses.filter(
    (entry) => supplementary === undefined || entry.supplementary === supplementary,
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
 */
export function SwipeableWordRow({
  setId,
  word,
  showMeanings = true,
  online = true,
  onPress,
  onToggleStar,
  onDelete,
}: {
  setId: string;
  word: Word;
  showMeanings?: boolean;
  online?: boolean;
  onPress: () => void;
  onToggleStar: () => void;
  onDelete?: () => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const main = meaningLine(word, false);
  const extra = meaningLine(word, true);
  const points = word.senses.flatMap((sense) => descriptionPoints(sense.description));

  const renderLeftActions = () => (
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        haptics.confirm();
        onToggleStar();
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
          onDelete();
        }}
        style={[styles.swipeAction, styles.deleteAction]}
      >
        <SymbolView name="trash.fill" size={20} weight="semibold" tintColor="#ffffff" />
        <Text style={styles.swipeLabel}>刪除</Text>
      </Pressable>
    ) : null;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
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
          onToggleStar();
          swipeRef.current?.close();
        }
      }}
    >
      <View style={styles.rowContainer}>
        <Pressable
          onPress={() => {
            haptics.select();
            onPress();
          }}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
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
        </Pressable>
        <View style={styles.starWrap}>
          <StarButton
            setId={setId}
            wordId={word.id}
            starred={word.starred}
            word={word.word}
          />
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 11,
    paddingLeft: space.row,
    paddingRight: 4,
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  textCol: {
    gap: 2,
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
