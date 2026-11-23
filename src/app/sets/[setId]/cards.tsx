import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DescriptionPoints } from "@/components/ui/description-points";
import { CONTENT_MAX_WIDTH, EmptyState, Loaded } from "@/components/ui/layout";
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

/** Spring that settles a released card without a visible wobble. */
const SETTLE = { damping: 20, stiffness: 240, mass: 0.8 } as const;
/** Spring for turning a card over: quick, with a small overshoot you can feel. */
const TURN = { damping: 15, stiffness: 160, mass: 0.9 } as const;
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 750;

function Deck({ content }: { content: SetContent }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [order, setOrder] = useState<string[]>(() =>
    [...content.words]
      .sort((a, b) => compareWords(a.word, b.word))
      .map((word) => word.id),
  );
  const [shuffle, setShuffle] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  /** Which neighbour sits under the top card: the next one, or the previous while dragging right. */
  const [peek, setPeek] = useState<1 | -1>(1);

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
  const under = deck[at + peek];
  const flipped = !!word && flippedId === word.id;
  const canNext = at < deck.length - 1;
  const canPrev = at > 0;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const flip = useSharedValue(0);
  const press = useSharedValue(1);
  const armed = useSharedValue(false);
  const busy = useSharedValue(false);

  // The card underneath becomes the top card: put the stage back in the same
  // commit that shows the new word, so nothing jumps.
  const wordId = word?.id;
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    flip.set(0);
    busy.set(false);
  }, [wordId, x, y, flip, busy]);

  useAnimatedReaction(
    () => (x.get() > 0 ? -1 : 1),
    (side, previous) => {
      if (side !== previous) runOnJS(setPeek)(side as 1 | -1);
    },
  );

  const commit = (step: 1 | -1) => {
    haptics.confirm();
    setIndex(at + step);
  };

  /** Throws the top card off the side it leaves from, then shows its neighbour. */
  const fling = (step: 1 | -1, velocity: number) => {
    busy.set(true);
    x.set(
      withSpring(
        -step * width * 1.35,
        { velocity, damping: 26, stiffness: 180, overshootClamping: true },
        (done) => {
          if (done) runOnJS(commit)(step);
        },
      ),
    );
    y.set(withSpring(y.get() * 1.6, SETTLE));
  };

  const go = (step: 1 | -1) => {
    if (busy.get()) return;
    if ((step === 1 && !canNext) || (step === -1 && !canPrev)) {
      haptics.warning();
      // A small shove that springs back: there is no card on that side.
      x.set(
        withSequence(
          withTiming(-step * 22, { duration: 90 }),
          withSpring(0, SETTLE),
        ),
      );
      return;
    }
    setPeek(step);
    fling(step, -step * 1400);
  };

  const toggleFlip = () => {
    haptics.tap();
    const next = !flipped;
    setFlippedId(next && word ? word.id : null);
    flip.set(withSpring(next ? 1 : 0, TURN));
    press.set(
      withSequence(withTiming(0.95, { duration: 110 }), withSpring(1, TURN)),
    );
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin(() => {
      press.set(withSpring(0.98, SETTLE));
    })
    .onUpdate((event) => {
      if (busy.get()) return;
      const blocked =
        (event.translationX < 0 && !canNext) ||
        (event.translationX > 0 && !canPrev);
      // Rubber band past either end of the deck.
      x.set(blocked ? event.translationX * 0.22 : event.translationX);
      y.set(event.translationY * 0.18);
      const past = !blocked && Math.abs(event.translationX) > COMMIT_DISTANCE;
      if (past !== armed.get()) {
        armed.set(past);
        runOnJS(haptics.select)();
      }
    })
    .onEnd((event) => {
      if (busy.get()) return;
      const step: 1 | -1 = event.translationX < 0 ? 1 : -1;
      const allowed = step === 1 ? canNext : canPrev;
      const thrown =
        Math.abs(event.translationX) > COMMIT_DISTANCE ||
        (Math.abs(event.velocityX) > COMMIT_VELOCITY &&
          Math.sign(event.velocityX) === Math.sign(event.translationX));
      if (allowed && thrown) {
        runOnJS(fling)(step, event.velocityX);
      } else {
        if (thrown) runOnJS(haptics.warning)();
        x.set(withSpring(0, { ...SETTLE, velocity: event.velocityX }));
        y.set(withSpring(0, SETTLE));
      }
    })
    .onFinalize(() => {
      armed.set(false);
      press.set(withSpring(1, SETTLE));
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onBegin(() => {
      press.set(withSpring(0.97, SETTLE));
    })
    .onEnd(() => {
      runOnJS(toggleFlip)();
    })
    .onFinalize(() => {
      press.set(withSpring(1, SETTLE));
    });

  const cardMove = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotateZ: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
      { scale: press.get() },
    ],
  }));
  const lift = useAnimatedStyle(() => {
    const t = Math.min(Math.abs(x.get()) / 160, 1);
    return {
      boxShadow: `0px ${8 + t * 14}px ${24 + t * 26}px rgba(17,21,18,${0.08 + t * 0.08})`,
    };
  });
  const underMove = useAnimatedStyle(() => {
    const t = Math.min(Math.abs(x.get()) / (width * 0.6), 1);
    return {
      opacity: interpolate(t, [0, 1], [0.55, 1]),
      transform: [
        { translateY: interpolate(t, [0, 1], [14, 0]) },
        { scale: interpolate(t, [0, 1], [0.92, 1]) },
      ],
    };
  });
  const front = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.get(), [0, 1], [0, 180])}deg` },
    ],
    opacity: flip.get() < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.get(), [0, 1], [180, 360])}deg` },
    ],
    opacity: flip.get() >= 0.5 ? 1 : 0,
  }));

  const starredCount = content.words.filter((entry) => entry.starred).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
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
            setIndex(0);
          }}
        />
        {starredCount > 0 ? (
          <Toggle
            label={`只看標星 ${starredCount}`}
            icon={starredOnly ? "star.fill" : "star"}
            active={starredOnly}
            onPress={() => {
              setStarredOnly(!starredOnly);
              setIndex(0);
            }}
          />
        ) : null}
      </View>

      {word ? (
        <View style={styles.stage}>
          <View style={styles.cardSlot}>
            {under ? (
              <Animated.View
                style={[styles.card, styles.under, underMove]}
                pointerEvents="none"
              >
                <Text
                  style={styles.word}
                  adjustsFontSizeToFit
                  numberOfLines={2}
                >
                  {under.word}
                </Text>
              </Animated.View>
            ) : null}
            <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
              <Animated.View style={[StyleSheet.absoluteFill, cardMove]}>
                <Animated.View style={[styles.card, lift, front]}>
                  <Text
                    style={styles.word}
                    adjustsFontSizeToFit
                    numberOfLines={2}
                  >
                    {word.word}
                  </Text>
                </Animated.View>
                <Animated.View
                  style={[styles.card, styles.cardBack, lift, back]}
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
          </View>
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
          disabled={!canPrev}
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
          disabled={!canNext}
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
  under: { boxShadow: "0px 4px 14px rgba(17,21,18,0.05)" },
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
