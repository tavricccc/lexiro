import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DescriptionPoints } from "@/components/ui/description-points";
import {
  CONTENT_MAX_WIDTH,
  Chip,
  EmptyState,
  Loaded,
} from "@/components/ui/layout";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SheetHeader } from "@/components/ui/sheet-header";
import { SpeakButton } from "@/components/ui/speak-button";
import { StarButton } from "@/components/ui/star-button";
import { compareWords, type SetContent, type Word } from "@/core/contract";
import { useSet } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { colors, latin, radius, space } from "@/lib/theme";

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
const TURN = { damping: 17, stiffness: 150, mass: 0.9 } as const;
/** A thrown card keeps the finger's speed and is not slowed by a bounce. */
const THROW = { damping: 24, stiffness: 120, overshootClamping: true } as const;
const COMMIT_DISTANCE = 100;
const COMMIT_VELOCITY = 650;
/** Points of vertical drag that turn the card half a turn. */
const TURN_DISTANCE = 260;

type Ghost = {
  key: number;
  word: Word;
  x: number;
  y: number;
  flip: number;
  velocity: number;
  step: 1 | -1;
};

/** Which way a card faces after `flip` half-turns: 0 front, 180 back. */
function faceAngle(flip: number) {
  "worklet";
  return (((flip * 180) % 360) + 360) % 360;
}

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
  /** Which neighbour sits under the top card: the next one, or the previous while dragging right. */
  const [peek, setPeek] = useState<1 | -1>(1);
  /** Cards already thrown, still flying off screen while the next one is in play. */
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

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
  const canNext = at < deck.length - 1;
  const canPrev = at > 0;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const flip = useSharedValue(0);
  /** Where the turning card is headed, in half-turns; taps add to it so quick taps keep spinning. */
  const aim = useSharedValue(0);
  const turnBase = useSharedValue(0);
  const press = useSharedValue(1);
  const armed = useSharedValue(false);
  const entering = useSharedValue(false);

  // The card underneath becomes the top card in the same commit that shows
  // the new word, so nothing jumps; it grows from where the stack held it.
  const wordId = word?.id;
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    flip.set(0);
    aim.set(0);
    if (entering.get()) {
      entering.set(false);
      press.set(0.94);
      press.set(withSpring(1, SETTLE));
    }
  }, [wordId, x, y, flip, aim, press, entering]);

  useAnimatedReaction(
    () => (x.get() > 0 ? -1 : 1),
    (side, previous) => {
      if (side !== previous) runOnJS(setPeek)(side as 1 | -1);
    },
  );
  // A light tick each time the card shows its other face.
  useAnimatedReaction(
    () => Math.round(flip.get()),
    (face, previous) => {
      if (previous !== null && face !== previous) runOnJS(haptics.select)();
    },
  );

  const throwCard = (
    step: 1 | -1,
    velocity: number,
    from: { x: number; y: number; flip: number },
  ) => {
    if (!word) return;
    haptics.confirm();
    setGhosts((list) => [
      ...list.slice(-3),
      { key: Date.now() + Math.random(), word, ...from, velocity, step },
    ]);
    entering.set(true);
    setPeek(step);
    setIndex(at + step);
  };

  const bump = (step: 1 | -1) => {
    haptics.warning();
    // A small shove that springs back: there is no card on that side.
    x.set(
      withSequence(
        withTiming(-step * 22, { duration: 80 }),
        withSpring(0, SETTLE),
      ),
    );
  };

  const go = (step: 1 | -1) => {
    if ((step === 1 && !canNext) || (step === -1 && !canPrev))
      return bump(step);
    throwCard(step, -step * 1800, { x: x.get(), y: y.get(), flip: flip.get() });
  };

  const turn = () => {
    haptics.tap();
    aim.set(Math.round(aim.get()) + 1);
    flip.set(withSpring(aim.get(), TURN));
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onBegin(() => {
      press.set(withSpring(0.98, SETTLE));
    })
    .onUpdate((event) => {
      const blocked =
        (event.translationX < 0 && !canNext) ||
        (event.translationX > 0 && !canPrev);
      // Rubber band past either end of the deck.
      x.set(blocked ? event.translationX * 0.22 : event.translationX);
      y.set(event.translationY * 0.25);
      const past = !blocked && Math.abs(event.translationX) > COMMIT_DISTANCE;
      if (past !== armed.get()) {
        armed.set(past);
        runOnJS(haptics.select)();
      }
    })
    .onEnd((event) => {
      const step: 1 | -1 = event.translationX < 0 ? 1 : -1;
      const allowed = step === 1 ? canNext : canPrev;
      const thrown =
        Math.abs(event.translationX) > COMMIT_DISTANCE ||
        (Math.abs(event.velocityX) > COMMIT_VELOCITY &&
          Math.sign(event.velocityX) === Math.sign(event.translationX));
      if (allowed && thrown) {
        runOnJS(throwCard)(step, event.velocityX, {
          x: x.get(),
          y: y.get(),
          flip: flip.get(),
        });
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

  // Drag up or down to turn the card by hand; let go and it keeps spinning
  // with the flick's speed, then lands on whichever face is nearer.
  const spin = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-18, 18])
    .onBegin(() => {
      turnBase.set(flip.get());
    })
    .onUpdate((event) => {
      flip.set(turnBase.get() - event.translationY / TURN_DISTANCE);
    })
    .onEnd((event) => {
      const speed = -event.velocityY / TURN_DISTANCE;
      const target = Math.round(flip.get() + speed * 0.22);
      aim.set(target);
      flip.set(withSpring(target, { ...TURN, velocity: speed }));
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onBegin(() => {
      press.set(withSpring(0.97, SETTLE));
    })
    .onEnd(() => {
      runOnJS(turn)();
    })
    .onFinalize(() => {
      press.set(withSpring(1, SETTLE));
    });

  const cardMove = useAnimatedStyle(() => {
    // 0 at rest, 1 when the card stands on its edge mid-turn: it lifts off the
    // table and comes closer while it turns, then settles back down.
    const turning = Math.abs(flip.get() - Math.round(flip.get())) * 2;
    return {
      transform: [
        { translateX: x.get() },
        { translateY: y.get() - turning * 26 },
        { rotateZ: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
        { scale: press.get() },
      ],
    };
  });
  const underMove = useAnimatedStyle(() => {
    const t = Math.min(Math.abs(x.get()) / (width * 0.55), 1);
    return {
      opacity: interpolate(t, [0, 1], [0.6, 1]),
      transform: [
        { translateY: interpolate(t, [0, 1], [14, 0]) },
        { scale: interpolate(t, [0, 1], [0.94, 1]) },
      ],
    };
  });

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
                style={[styles.card, underMove]}
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
            <GestureDetector
              gesture={Gesture.Exclusive(Gesture.Race(swipe, spin), tap)}
            >
              <Animated.View style={[StyleSheet.absoluteFill, cardMove]}>
                <CardFaces word={word} flip={flip} />
              </Animated.View>
            </GestureDetector>
            {ghosts.map((ghost) => (
              <FlyingCard
                key={ghost.key}
                ghost={ghost}
                width={width}
                onGone={() =>
                  setGhosts((list) =>
                    list.filter((entry) => entry.key !== ghost.key),
                  )
                }
              />
            ))}
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
          onPress={turn}
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

/** Both faces of one card, turned by `flip` half-turns. */
function CardFaces({ word, flip }: { word: Word; flip: SharedValue<number> }) {
  const front = useAnimatedStyle(() => {
    const angle = faceAngle(flip.get());
    return {
      transform: [{ perspective: 2400 }, { rotateY: `${angle}deg` }],
      opacity: angle < 90 || angle > 270 ? 1 : 0,
    };
  });
  const back = useAnimatedStyle(() => {
    const angle = faceAngle(flip.get());
    return {
      transform: [{ perspective: 2400 }, { rotateY: `${angle + 180}deg` }],
      opacity: angle >= 90 && angle <= 270 ? 1 : 0,
    };
  });
  // The shadow lives on a flat plate that narrows with the turn, so the
  // turning faces carry no shadow and their text stays sharp.
  const plate = useAnimatedStyle(() => {
    const angle = faceAngle(flip.get());
    return {
      transform: [{ scaleX: Math.max(Math.abs(Math.cos((angle * Math.PI) / 180)), 0.02) }],
    };
  });
  const original = word.senses.filter((sense) => !sense.supplementary);
  const extra = word.senses.filter((sense) => sense.supplementary);

  return (
    <>
      <Animated.View style={[styles.plate, plate]} />
      <Animated.View style={[styles.card, front]}>
        <Text style={styles.word} adjustsFontSizeToFit numberOfLines={2}>
          {word.word}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.cardBack, back]}>
        <Text style={styles.backWord} numberOfLines={1}>
          {word.word}
        </Text>
        <ScrollView
          style={styles.backScroll}
          contentContainerStyle={styles.senses}
          showsVerticalScrollIndicator={false}
        >
          {original.map((sense) => (
            <SenseBlock key={sense.id} sense={sense} />
          ))}
          {extra.length ? (
            <View style={styles.extraGroup}>
              <Chip label="補充" tone="info" />
              {extra.map((sense) => (
                <SenseBlock key={sense.id} sense={sense} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </>
  );
}

/** A thrown card: carries on from where the finger let go, with its speed, and leaves the screen. */
function FlyingCard({
  ghost,
  width,
  onGone,
}: {
  ghost: Ghost;
  width: number;
  onGone: () => void;
}) {
  const x = useSharedValue(ghost.x);
  const y = useSharedValue(ghost.y);
  const flip = useSharedValue(ghost.flip);

  useEffect(() => {
    const target = -ghost.step * width * 1.5;
    x.set(
      withSpring(target, { ...THROW, velocity: ghost.velocity }, (done) => {
        if (done) runOnJS(onGone)();
      }),
    );
    y.set(withSpring(ghost.y * 2 + 40, THROW));
    flip.set(withSpring(Math.round(ghost.flip), TURN));
    // Runs once: the card is already in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotateZ: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, move]} pointerEvents="none">
      <CardFaces word={ghost.word} flip={flip} />
    </Animated.View>
  );
}

function SenseBlock({ sense }: { sense: Word["senses"][number] }) {
  return (
    <View style={styles.sense}>
      <Text style={styles.meaning}>
        <Text style={styles.pos}>{sense.pos} </Text>
        {sense.meaning}
      </Text>
      <DescriptionPoints description={sense.description} />
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  plate: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    borderRadius: radius.hero,
    borderCurve: "continuous",
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
  backScroll: { flex: 1, alignSelf: "stretch" },
  extraGroup: { gap: 10, alignItems: "flex-start" },
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
