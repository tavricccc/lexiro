import { useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
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
import { CONTENT_MAX_WIDTH, Chip, EmptyState, Loaded } from "@/components/ui/layout";
import { Button, IconButton } from "@/components/ui/button";
import { timing } from "@/components/ui/motion";
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
      {content.data ? null : <SheetHeader title="單字卡" />}
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

/**
 * Springs for a card with some weight to it: more mass means a flick carries
 * it further and it takes a moment to get going and to stop.
 */
const SETTLE = { damping: 26, stiffness: 260, mass: 1.2 } as const;
/** Turning over: heavy enough to coast on a flick, landing with a small rock. */
const TURN = { damping: 26, stiffness: 200, mass: 1.4 } as const;
/** A thrown card keeps the finger's speed and is not slowed by a bounce. */
const THROW = { damping: 24, stiffness: 120, overshootClamping: true } as const;
/** A card put back on the pile lands and stays: no bounce off the table. */
const LAND = { damping: 30, stiffness: 220, mass: 1.2, overshootClamping: true } as const;
const COMMIT_DISTANCE = 100;
const COMMIT_VELOCITY = 650;
/** Points of vertical drag that turn the card half a turn. */
const TURN_DISTANCE = 260;
/** How deep the turn looks: the distance, in points, from the eye to the card. */
const PERSPECTIVE = 1200;
/** Cards drawn under the top one. */
const PILE = 3;

type Ghost = {
  key: number;
  word: Word;
  x: number;
  y: number;
  flip: number;
  axis: number;
  grab: number;
  velocity: number;
  /** The side it leaves by: -1 left, 1 right. */
  side: 1 | -1;
};

/** Which way a card faces after `flip` half-turns: 0 front, 180 back. */
function faceAngle(flip: number) {
  "worklet";
  return (((flip * 180) % 360) + 360) % 360;
}

/** An angle folded into (-180, 180]. */
function signed(angle: number) {
  "worklet";
  const a = ((angle % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

/**
 * A face turned in real 3D around the card's middle. At rest the face gets no
 * 3D transform at all: a perspective layer is drawn without edge smoothing on
 * iOS, so it only exists while the card is actually turning.
 */
function faceTurn(local: number, axis: number) {
  "worklet";
  if (Math.abs(local) < 0.05) return [{ translateX: 0 }];
  return [
    { perspective: PERSPECTIVE },
    axis === 1 ? { rotateX: `${local}deg` } : { rotateY: `${local}deg` },
  ];
}

/** A steady scatter for each word, so the pile looks the same every time it is seen. */
function scatterOf(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = (shift: number) => (((h >>> shift) & 0xff) / 255) * 2 - 1;
  const r = unit(0);
  return {
    rot: Math.sign(r || 1) * (1.4 + Math.abs(r) * 2.6),
    dx: unit(8) * 10,
    dy: unit(16) * 4,
  };
}
type Scatter = ReturnType<typeof scatterOf>;

/**
 * Where a card lies in the pile at `depth` (0 the top, fractions while cards
 * move): lower, a touch smaller, and askew, so the edges of the cards under
 * the top one show.
 */
function piled(depth: number, scatter: Scatter) {
  "worklet";
  const askew = Math.min(Math.max(depth, 0), 1);
  return {
    x: scatter.dx * askew,
    y: depth * 9 + scatter.dy * askew,
    rot: scatter.rot * askew,
    scale: 1 - depth * 0.035,
  };
}

function Deck({ content }: { content: SetContent }) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const [order, setOrder] = useState<string[]>(() =>
    [...content.words].sort((a, b) => compareWords(a.word, b.word)).map((word) => word.id),
  );
  const [shuffle, setShuffle] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [index, setIndex] = useState(0);
  /** Cards already thrown, still flying off screen while the next one is in play. */
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  /** The side each thrown card left by, so going back brings it in from there. */
  const [leftBy, setLeftBy] = useState<Record<string, 1 | -1>>({});

  const byId = useMemo(
    () => new Map(content.words.map((word) => [word.id, word])),
    [content.words],
  );
  const deck = useMemo(
    () =>
      order
        .map((id) => byId.get(id))
        .filter((word): word is Word => !!word && (!starredOnly || word.starred)),
    [order, byId, starredOnly],
  );
  const at = Math.min(index, Math.max(0, deck.length - 1));
  const word = deck[at];
  const previous = deck[at - 1];
  const pile = deck.slice(at + 1, at + 1 + PILE);
  const canNext = at < deck.length - 1;
  const canPrev = at > 0;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const flip = useSharedValue(0);
  /** 0 turns the card left to right (a tap), 1 top over bottom (a drag up or down). */
  const axis = useSharedValue(0);
  /** Where the turning card is headed, in half-turns; taps add to it so quick taps keep spinning. */
  const aim = useSharedValue(0);
  const turnBase = useSharedValue(0);
  const press = useSharedValue(1);
  /** 1 while a finger holds the card up off the pile. */
  const lift = useSharedValue(0);
  /** Where the card was held: 1 near the top edge, -1 near the bottom; decides which way it swings. */
  const grab = useSharedValue(1);
  const slotHeight = useSharedValue(1);
  const armed = useSharedValue(false);
  /**
   * How far the whole pile has moved up by one card: toward 1 while the top
   * card is pulled away, toward -1 while the previous card flies back on.
   * Every card lies at its depth minus this.
   */
  const shift = useSharedValue(0);
  /**
   * After a throw, how far the new top card still has to rise out of the
   * pile, in cards; it drops to 0 as the pile settles.
   */
  const arrive = useSharedValue(0);
  /** What `arrive` starts from once the new top card is in place. */
  const pendingArrive = useSharedValue(0);

  // The card underneath becomes the top card in the same commit that shows
  // the new word, and `arrive` takes over what `shift` held, so every card in
  // the pile carries on from exactly where it was.
  const wordId = word?.id;
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    flip.set(0);
    aim.set(0);
    axis.set(0);
    shift.set(0);
    const from = pendingArrive.get();
    pendingArrive.set(0);
    arrive.set(from);
    if (from !== 0) arrive.set(withSpring(0, LAND));
  }, [wordId, x, y, flip, aim, axis, shift, arrive, pendingArrive]);

  // A light tick each time the card shows its other face.
  useAnimatedReaction(
    () => Math.round(flip.get()),
    (face, last) => {
      if (last !== null && face !== last) runOnJS(haptics.select)();
    },
  );

  const throwCard = (
    side: 1 | -1,
    velocity: number,
    from: { x: number; y: number; flip: number },
  ) => {
    if (!word) return;
    haptics.confirm();
    setGhosts((list) => [
      ...list.slice(-3),
      {
        key: Date.now() + Math.random(),
        word,
        ...from,
        axis: axis.get(),
        grab: grab.get(),
        velocity,
        side,
      },
    ]);
    setLeftBy((sides) => ({ ...sides, [word.id]: side }));
    pendingArrive.set(1 - Math.min(Math.max(shift.get(), 0), 1));
    setIndex(at + 1);
  };

  /** The previous card has landed back on the pile, with a small thud. */
  const putBack = () => {
    haptics.confirm();
    pendingArrive.set(0);
    setIndex((current) => Math.max(0, current - 1));
    press.set(withSequence(withTiming(0.975, timing.press), withSpring(1, SETTLE)));
  };

  const bump = (step: 1 | -1) => {
    haptics.warning();
    // A small shove that springs back: there is no card on that side.
    x.set(withSequence(withTiming(-step * 22, { duration: 80 }), withSpring(0, SETTLE)));
  };

  const go = (step: 1 | -1) => {
    if ((step === 1 && !canNext) || (step === -1 && !canPrev)) return bump(step);
    if (step === -1) {
      // The card that went last flies back in from the side it left by.
      shift.set(
        withSpring(-1, LAND, (done) => {
          if (done) runOnJS(putBack)();
        }),
      );
      return;
    }
    grab.set(1);
    throwCard(-1, -1800, { x: x.get(), y: y.get(), flip: flip.get() });
  };

  const turn = () => {
    haptics.tap();
    // A turn under way keeps its axis; a card at rest turns left to right.
    if (Math.abs(flip.get() - Math.round(flip.get())) < 0.02) axis.set(0);
    aim.set(Math.round(aim.get()) + 1);
    flip.set(withSpring(aim.get(), TURN));
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onBegin((event) => {
      const fromMiddle = Math.min(Math.max(1 - (2 * event.y) / slotHeight.get(), -1), 1);
      grab.set(Math.sign(fromMiddle || 1) * (0.45 + 0.55 * Math.abs(fromMiddle)));
      lift.set(withSpring(1, SETTLE));
    })
    .onUpdate((event) => {
      // Either way off the pile is the next card; going back is the button's job.
      const tx = event.translationX;
      const blocked = !canNext;
      if (blocked) {
        // Rubber band at the end of the deck.
        x.set(tx * 0.22);
        y.set(event.translationY * 0.25);
        shift.set(0);
      } else {
        x.set(tx);
        y.set(event.translationY * 0.25);
        shift.set(Math.min(Math.abs(tx) / (width * 0.6), 1));
      }
      const past = !blocked && Math.abs(tx) > COMMIT_DISTANCE;
      if (past !== armed.get()) {
        armed.set(past);
        runOnJS(haptics.select)();
      }
    })
    .onEnd((event) => {
      const tx = event.translationX;
      const allowed = canNext;
      const thrown =
        Math.abs(tx) > COMMIT_DISTANCE ||
        (Math.abs(event.velocityX) > COMMIT_VELOCITY &&
          Math.sign(event.velocityX) === Math.sign(tx));
      if (allowed && thrown) {
        runOnJS(throwCard)(tx < 0 ? -1 : 1, event.velocityX, {
          x: x.get(),
          y: y.get(),
          flip: flip.get(),
        });
      } else {
        if (thrown) runOnJS(haptics.warning)();
        x.set(withSpring(0, { ...SETTLE, velocity: event.velocityX }));
        y.set(withSpring(0, SETTLE));
        shift.set(withSpring(0, SETTLE));
      }
    })
    .onFinalize(() => {
      armed.set(false);
      lift.set(withSpring(0, SETTLE));
    });

  // Drag up or down to turn the card over top to bottom; let go and it keeps
  // spinning with the flick's speed, then lands on whichever face is nearer.
  const spin = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-18, 18])
    .onBegin(() => {
      turnBase.set(flip.get());
    })
    .onStart(() => {
      // Switching axis is only invisible while a face lies flat.
      if (Math.abs(flip.get() - Math.round(flip.get())) < 0.02) axis.set(1);
    })
    .onUpdate((event) => {
      flip.set(turnBase.get() - event.translationY / TURN_DISTANCE);
    })
    .onEnd((event) => {
      const speed = -event.velocityY / TURN_DISTANCE;
      const target = Math.round(flip.get() + speed * 0.3);
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

  const scatter = useMemo(() => (word ? scatterOf(word.id) : scatterOf("")), [word]);
  const cardMove = useAnimatedStyle(() => {
    // 0 at rest, 1 when the card stands on its edge mid-turn: it rises off the
    // pile while it turns, then drops back down.
    const turning = Math.abs(flip.get() - Math.round(flip.get())) * 2;
    // Pulled back under the card coming on, or still settling after the one
    // above it was thrown.
    const lying = piled(Math.max(-shift.get(), 0) + arrive.get(), scatter);
    const swing = interpolate(x.get(), [-width, width], [-16, 16]) * grab.get();
    return {
      transform: [
        { translateX: x.get() + lying.x },
        { translateY: y.get() + lying.y - turning * 22 - lift.get() * 4 },
        { rotateZ: `${swing + lying.rot}deg` },
        { scale: press.get() * lying.scale },
      ],
    };
  });

  const starredCount = content.words.filter((entry) => entry.starred).length;

  return (
    <View style={[styles.root, { paddingTop: headerHeight }]}>
      <SheetHeader title={deck.length ? `${at + 1} / ${deck.length}` : "單字卡"} />

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
          <View
            style={styles.cardSlot}
            onLayout={(event) => slotHeight.set(event.nativeEvent.layout.height || 1)}
          >
            {pile
              .map((entry, i) => (
                <PileCard
                  key={entry.id}
                  word={entry}
                  depth={i + 1}
                  shift={shift}
                  arrive={arrive}
                />
              ))
              .reverse()}
            <GestureDetector gesture={Gesture.Exclusive(Gesture.Race(swipe, spin), tap)}>
              <Animated.View style={[StyleSheet.absoluteFill, cardMove]}>
                <CardFaces word={word} flip={flip} axis={axis} lift={lift} />
              </Animated.View>
            </GestureDetector>
            {previous ? (
              <ReturningCard
                key={previous.id}
                word={previous}
                side={leftBy[previous.id] ?? -1}
                shift={shift}
                width={width}
              />
            ) : null}
            {ghosts.map((ghost) => (
              <FlyingCard
                key={ghost.key}
                ghost={ghost}
                width={width}
                onGone={() => setGhosts((list) => list.filter((entry) => entry.key !== ghost.key))}
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

      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <IconButton
          size={56}
          haptic={false}
          icon="chevron.left"
          label="上一張"
          disabled={!canPrev}
          onPress={() => go(-1)}
        />
        <IconButton
          size={56}
          haptic={false}
          icon="arrow.trianglehead.2.clockwise.rotate.90"
          label="翻面"
          disabled={!word}
          onPress={turn}
        />
        <IconButton
          size={56}
          haptic={false}
          icon="chevron.right"
          label="下一張"
          disabled={!canNext}
          onPress={() => go(1)}
        />
      </View>
    </View>
  );
}

/** A card waiting in the pile under the top one; it moves up as the cards above it go. */
const PileCard = memo(function PileCard({
  word,
  depth,
  shift,
  arrive,
}: {
  word: Word;
  depth: number;
  shift: SharedValue<number>;
  arrive: SharedValue<number>;
}) {
  const scatter = useMemo(() => scatterOf(word.id), [word.id]);
  const move = useAnimatedStyle(() => {
    const d = depth - shift.get() + arrive.get();
    const lying = piled(d, scatter);
    return {
      // The bottom card of the pile appears from under it rather than popping in.
      opacity: interpolate(d, [PILE, PILE + 0.6], [1, 0], "clamp"),
      transform: [
        { translateX: lying.x },
        { translateY: lying.y },
        { rotateZ: `${lying.rot}deg` },
        { scale: lying.scale },
      ],
    };
  });
  return (
    <Animated.View style={[styles.card, styles.pileCard, move]} pointerEvents="none">
      <Text style={styles.word} adjustsFontSizeToFit numberOfLines={2}>
        {word.word}
      </Text>
    </Animated.View>
  );
});

/**
 * The card before this one, waiting off screen on the side it was thrown to.
 * Going back, it flies in along a low arc, held a little above the pile, and
 * drops onto it.
 */
const ReturningCard = memo(function ReturningCard({
  word,
  side,
  shift,
  width,
}: {
  word: Word;
  side: 1 | -1;
  shift: SharedValue<number>;
  width: number;
}) {
  const move = useAnimatedStyle(() => {
    const on = Math.min(Math.max(-shift.get(), 0), 1);
    const away = 1 - on;
    return {
      opacity: on > 0 ? 1 : 0,
      transform: [
        { translateX: side * width * 1.2 * away },
        { translateY: away * 40 - Math.sin(on * Math.PI) * 34 },
        { rotateZ: `${side * away * 18}deg` },
        { scale: 1 + away * 0.06 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.card, styles.lifted, move]} pointerEvents="none">
      <Text style={styles.word} adjustsFontSizeToFit numberOfLines={2}>
        {word.word}
      </Text>
    </Animated.View>
  );
});

/** Both faces of one card, turned by `flip` half-turns. */
function CardFaces({
  word,
  flip,
  axis,
  lift,
}: {
  word: Word;
  flip: SharedValue<number>;
  axis: SharedValue<number>;
  lift?: SharedValue<number>;
}) {
  // The shadow lies on the table under the card: it narrows with the turn and
  // spreads and softens as the card rises, so the faces themselves carry none.
  const plate = useAnimatedStyle(() => {
    const angle = faceAngle(flip.get());
    const lean = Math.abs(Math.cos((angle * Math.PI) / 180));
    const turning = Math.abs(flip.get() - Math.round(flip.get())) * 2;
    const up = Math.max(turning, lift ? lift.get() : 0);
    const narrow = Math.max(lean * (1 - turning * 0.08), 0.02);
    return {
      boxShadow: `0 ${6 + up * 18}px ${16 + up * 30}px rgba(17,21,18,${0.12 - up * 0.04})`,
      transform: [axis.get() === 1 ? { scaleY: narrow } : { scaleX: narrow }],
    };
  });
  const front = useAnimatedStyle(() => {
    const local = signed(faceAngle(flip.get()));
    return {
      transform: faceTurn(local, axis.get()),
      opacity: Math.abs(local) < 90 ? 1 : 0,
    };
  });
  const back = useAnimatedStyle(() => {
    const local = signed(faceAngle(flip.get()) - 180);
    return {
      transform: faceTurn(local, axis.get()),
      opacity: Math.abs(local) <= 90 ? 1 : 0,
    };
  });
  // A face tipped away from the light darkens as it turns.
  const frontShade = useAnimatedStyle(() => {
    const local = signed(faceAngle(flip.get()));
    return { opacity: (1 - Math.abs(Math.cos((local * Math.PI) / 180))) * 0.35 };
  });
  const backShade = useAnimatedStyle(() => {
    const local = signed(faceAngle(flip.get()) - 180);
    return { opacity: (1 - Math.abs(Math.cos((local * Math.PI) / 180))) * 0.35 };
  });
  const original = word.senses.filter((sense) => !sense.supplementary);
  const extra = word.senses.filter((sense) => sense.supplementary);

  return (
    <>
      <Animated.View style={[styles.plate, plate]} />
      <Animated.View style={[styles.card, styles.face, front]}>
        <Text style={styles.word} adjustsFontSizeToFit numberOfLines={2}>
          {word.word}
        </Text>
        <Animated.View style={[styles.shade, frontShade]} pointerEvents="none" />
      </Animated.View>
      <Animated.View style={[styles.card, styles.face, styles.cardBack, back]}>
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
        <Animated.View style={[styles.shade, backShade]} pointerEvents="none" />
      </Animated.View>
    </>
  );
}

/** A thrown card: carries on from where the finger let go, with its speed, and leaves the screen. */
function FlyingCard({ ghost, width, onGone }: { ghost: Ghost; width: number; onGone: () => void }) {
  const x = useSharedValue(ghost.x);
  const y = useSharedValue(ghost.y);
  const flip = useSharedValue(ghost.flip);
  const axis = useSharedValue(ghost.axis);
  const lift = useSharedValue(1);

  useEffect(() => {
    const target = ghost.side * width * 1.5;
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
      { rotateZ: `${interpolate(x.get(), [-width, width], [-16, 16]) * ghost.grab}deg` },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, move]} pointerEvents="none">
      <CardFaces word={ghost.word} flip={flip} axis={axis} lift={lift} />
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
    <Button
      label={label}
      icon={icon}
      size="sm"
      variant={active ? "accent" : "ghost"}
      onPress={onPress}
    />
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  /** Under the top card: a short shadow of its own, so each edge in the pile reads. */
  pileCard: { boxShadow: "0 2px 6px rgba(17,21,18,0.10)" },
  /** Held in the hand, above the pile. */
  lifted: { boxShadow: "0 20px 40px rgba(17,21,18,0.14)" },
  /** A turning face clips its shade to the card's corners. */
  face: { overflow: "hidden" },
  /** Only its shadow is drawn: a filled plate would show past the far edge of a turning face. */
  plate: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.hero,
    borderCurve: "continuous",
  },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
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
});
