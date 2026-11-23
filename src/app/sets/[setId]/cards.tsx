import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DescriptionPoints } from "@/components/ui/description-points";
import { CONTENT_MAX_WIDTH, EmptyState, Loaded } from "@/components/ui/layout";
import { EASE_MOVE } from "@/components/ui/motion";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SheetHeader } from "@/components/ui/sheet-header";
import { SpeakButton } from "@/components/ui/speak-button";
import { StarButton } from "@/components/ui/star-button";
import { compareWords, type SetContent, type Word } from "@/core/contract";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, space, type } from "@/lib/theme";

/** Flip-through word cards for one set: word on the front, senses on the back. */
export default function CardsScreen() {
  const { setId = "" } = useLocalSearchParams<{ setId: string }>();
  const content = useSet(setId);
  return (
    <View style={styles.root}>
      <Loaded query={content}>{(data) => <Deck content={data} />}</Loaded>
    </View>
  );
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function Deck({ content }: { content: SetContent }) {
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<string[]>(() =>
    [...content.words]
      .sort((a, b) => compareWords(a.word, b.word))
      .map((word) => word.id),
  );
  const [shuffle, setShuffle] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const byId = useMemo(
    () => new Map(content.words.map((word) => [word.id, word])),
    [content.words],
  );
  const deck = useMemo(
    () =>
      order
        .map((id) => byId.get(id))
        .filter(
          (word): word is Word => !!word && (!starredOnly || word.starred),
        ),
    [order, byId, starredOnly],
  );
  const at = Math.min(index, Math.max(0, deck.length - 1));
  const word = deck[at];

  const flip = useSharedValue(0);
  const drag = useSharedValue(0);

  const show = (next: number) => {
    setIndex(next);
    setFlipped(false);
    flip.value = 0;
  };

  const go = (step: number) => {
    const next = at + step;
    if (next < 0 || next >= deck.length) {
      haptics.warning();
      return;
    }
    haptics.select();
    show(next);
  };

  const toggleFlip = () => {
    haptics.tap();
    const next = !flipped;
    setFlipped(next);
    flip.value = withTiming(next ? 1 : 0, { duration: 320, easing: EASE_MOVE });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      drag.value = event.translationX;
    })
    .onEnd((event) => {
      const step =
        event.translationX < -80 ? 1 : event.translationX > 80 ? -1 : 0;
      drag.value = withTiming(0, { duration: 200 });
      if (step) runOnJS(go)(step);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(toggleFlip)();
  });

  const cardMove = useAnimatedStyle(() => ({
    transform: [
      { translateX: drag.value },
      { rotateZ: `${interpolate(drag.value, [-300, 300], [-8, 8])}deg` },
    ],
  }));
  const front = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));

  const starredCount = content.words.filter((entry) => entry.starred).length;

  return (
    <View style={styles.root}>
      <SheetHeader
        title="單字卡"
        subtitle={deck.length ? `${at + 1} / ${deck.length}` : undefined}
      />

      <View style={styles.options}>
        <Toggle
          label="隨機"
          icon="shuffle"
          active={shuffle}
          onPress={() => {
            const next = !shuffle;
            setShuffle(next);
            setOrder(
              next
                ? shuffled(order)
                : [...content.words]
                    .sort((a, b) => compareWords(a.word, b.word))
                    .map((entry) => entry.id),
            );
            show(0);
          }}
        />
        {starredCount > 0 ? (
          <Toggle
            label={`只看標星 ${starredCount}`}
            icon={starredOnly ? "star.fill" : "star"}
            active={starredOnly}
            onPress={() => {
              setStarredOnly(!starredOnly);
              show(0);
            }}
          />
        ) : null}
      </View>

      {word ? (
        <View style={styles.stage}>
          <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
            <Animated.View style={[styles.cardSlot, cardMove]}>
              <Animated.View
                style={[styles.card, front]}
                pointerEvents={flipped ? "none" : "auto"}
              >
                <Text
                  style={styles.word}
                  adjustsFontSizeToFit
                  numberOfLines={2}
                >
                  {word.word}
                </Text>
              </Animated.View>
              <Animated.View
                style={[styles.card, styles.cardBack, back]}
                pointerEvents={flipped ? "auto" : "none"}
              >
                <Text style={styles.backWord} numberOfLines={1}>
                  {word.word}
                </Text>
                <View style={styles.senses}>
                  {word.senses.map((sense) => (
                    <View key={sense.id} style={styles.sense}>
                      <Text style={styles.meaning}>
                        <Text style={styles.pos}>{sense.pos} </Text>
                        {sense.meaning}
                        {sense.supplementary ? (
                          <Text style={styles.extra}>　補充</Text>
                        ) : null}
                      </Text>
                      <DescriptionPoints description={sense.description} />
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
          <View style={styles.cardActions}>
            <SpeakButton text={word.word} size={22} />
            <StarButton
              setId={content.set.id}
              wordId={word.id}
              starred={word.starred}
              word={word.word}
            />
          </View>
        </View>
      ) : (
        <View style={styles.stage}>
          <EmptyState icon="rectangle.on.rectangle.angled" title="沒有單字" />
        </View>
      )}

      <View
        style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <NavButton
          icon="chevron.left"
          label="上一張"
          disabled={at <= 0}
          onPress={() => go(-1)}
        />
        <NavButton
          icon="arrow.trianglehead.2.clockwise.rotate.90"
          label="翻面"
          disabled={!word}
          onPress={toggleFlip}
        />
        <NavButton
          icon="chevron.right"
          label="下一張"
          disabled={at >= deck.length - 1}
          onPress={() => go(1)}
        />
      </View>
    </View>
  );
}

function Toggle({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: "shuffle" | "star" | "star.fill";
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.95}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <SymbolView
        name={icon}
        size={14}
        weight="semibold"
        tintColor={active ? colors.canvas : colors.inkMuted}
      />
      <Text style={[styles.toggleText, active && { color: colors.canvas }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function NavButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon:
    | "chevron.left"
    | "chevron.right"
    | "arrow.trianglehead.2.clockwise.rotate.90";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navBtn,
        pressed && styles.navPressed,
        disabled && styles.disabled,
      ]}
    >
      <SymbolView
        name={icon}
        size={20}
        weight="semibold"
        tintColor={colors.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  options: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: space.gutter,
    paddingBottom: 8,
    alignSelf: "center",
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  toggleActive: { backgroundColor: colors.ink },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  stage: {
    flex: 1,
    paddingHorizontal: space.gutter,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardSlot: {
    width: "100%",
    maxWidth: 520,
    flex: 1,
    maxHeight: 560,
  },
  card: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backfaceVisibility: "hidden",
    boxShadow: "0 8px 24px rgba(17,21,18,0.08)",
  },
  cardBack: {
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 16,
  },
  word: {
    ...latin.bold,
    fontSize: 40,
    color: colors.ink,
    textAlign: "center",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingTop: 16,
  },
  backWord: { ...latin.bold, fontSize: 22, color: colors.ink },
  senses: { gap: 14 },
  sense: { gap: 6 },
  pos: { ...latin.semibold, color: colors.inkMuted },
  meaning: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 27,
  },
  extra: { ...type.hint, color: colors.inkFaint },
  nav: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    paddingTop: 10,
  },
  navBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  navPressed: { backgroundColor: colors.surfacePressed },
  disabled: { opacity: 0.35 },
});
