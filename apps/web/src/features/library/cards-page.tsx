import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { ArrowsClockwise, CaretLeft, CaretRight, Shuffle, Star, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { compareWords, descriptionPoints, type SetContent, type Word } from "@lexiro/contract";
import { AppLink, Button, Chip, EmptyState, HeaderButton, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { starWords } from "@/data/library";
import { useSet } from "@/data/queries";
import { Loaded } from "@/ui/page";
import { SpeakButton, speak } from "@/ui/speak";
import { StarButton } from "@/ui/star-button";
import { useDocumentTitle } from "@/ui/title";

/** Flip-through word cards for one set: word on the front, senses on the back. */
export default function CardsPage() {
  const { setId = "" } = useParams();
  const content = useSet(setId);
  useDocumentTitle(content.data ? `${content.data.set.name} · 單字卡` : "單字卡");
  return (
    <Loaded query={content}>
      {(data) => <Deck content={data} />}
    </Loaded>
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

/** Springs matching the app's physical deck feel. */
const SETTLE = { type: "spring", damping: 26, stiffness: 260, mass: 1.2 } as const;
const TURN = { type: "spring", damping: 26, stiffness: 340, mass: 1 } as const;
const THROW = { type: "spring", damping: 24, stiffness: 120, bounce: 0 } as const;
const LAND = { type: "spring", damping: 30, stiffness: 220, mass: 1.2, bounce: 0 } as const;

const COMMIT_DISTANCE = 100;
const COMMIT_VELOCITY = 650;
/** Pixels of vertical drag that turn the card half a turn. */
const TURN_DISTANCE = 260;
const PERSPECTIVE = 1200;
/** Cards drawn under the top one. */
const PILE = 3;

interface Ghost {
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
}

/** Which way a card faces after `flip` half-turns: 0 front, 180 back. */
function faceAngle(flip: number) {
  return (((flip * 180) % 360) + 360) % 360;
}

/** An angle folded into (-180, 180]. */
function signed(angle: number) {
  const a = ((angle % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
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

/** Where a card lies in the pile at `depth` (0 the top, fractions while cards move). */
function piled(depth: number, scatter: Scatter) {
  const askew = Math.min(Math.max(depth, 0), 1);
  return {
    x: scatter.dx * askew,
    y: depth * 9 + scatter.dy * askew,
    rot: scatter.rot * askew,
    scale: 1 - depth * 0.035,
  };
}

function Deck({ content }: { content: SetContent }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
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
  const [flippedSide, setFlippedSide] = useState(false);

  const byId = useMemo(
    () => new Map(content.words.map((word) => [word.id, word])),
    [content.words],
  );
  const deck = useMemo(
    () =>
      order
        .map((id) => byId.get(id))
        .filter((word): word is Word => word !== undefined && (!starredOnly || word.starred)),
    [order, byId, starredOnly],
  );
  const at = Math.min(index, Math.max(0, deck.length - 1));
  const word = deck[at];
  const previous = deck[at - 1];
  const pile = deck.slice(at + 1, at + 1 + PILE);
  const canNext = at < deck.length - 1;
  const canPrev = at > 0;

  const slotRef = useRef<HTMLDivElement>(null);
  const backScrollRef = useRef<HTMLDivElement>(null);
  const returningRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const flip = useMotionValue(0);
  /** 0 turns the card left to right (a tap), 1 top over bottom (a drag up or down). */
  const axis = useMotionValue(0);
  const aim = useRef(0);
  const press = useMotionValue(1);
  const lift = useMotionValue(0);
  const grab = useMotionValue(1);
  const shift = useMotionValue(0);
  const arrive = useMotionValue(0);
  const pendingArrive = useRef(0);

  const wordId = word?.id;
  useLayoutEffect(() => {
    x.stop();
    y.stop();
    flip.stop();
    shift.stop();
    arrive.stop();
    x.set(0);
    y.set(0);
    flip.set(0);
    aim.current = 0;
    axis.set(0);
    shift.set(0);
    setFlippedSide(false);
    const from = pendingArrive.current;
    pendingArrive.current = 0;
    arrive.set(from);
    if (from !== 0) {
      if (reduced) arrive.set(0);
      else void animate(arrive, 0, LAND);
    }
  }, [wordId, x, y, flip, axis, shift, arrive, reduced]);

  // Track whether the back face is settled up so scroll/a11y reflect the active face.
  useEffect(() => {
    return flip.on("change", (v) => {
      setFlippedSide(Math.abs(Math.round(v)) % 2 === 1);
    });
  }, [flip]);

  const throwCard = useCallback(
    (side: 1 | -1, velocity: number, from: { x: number; y: number; flip: number }) => {
      if (!word) return;
      if (!reduced) {
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
      }
      setLeftBy((sides) => ({ ...sides, [word.id]: side }));
      pendingArrive.current = reduced ? 0 : 1 - Math.min(Math.max(shift.get(), 0), 1);
      setIndex(at + 1);
    },
    [word, axis, grab, shift, at, reduced],
  );

  const bump = useCallback(
    (step: 1 | -1) => {
      if (reduced) return;
      void animate(x, -step * 20, { duration: 0.08 }).then(() => {
        void animate(x, 0, SETTLE);
      });
    },
    [x, reduced],
  );

  const go = useCallback(
    (step: 1 | -1) => {
      if ((step === 1 && !canNext) || (step === -1 && !canPrev)) {
        bump(step);
        return;
      }
      if (step === -1) {
        if (returningRef.current) return;
        if (reduced) {
          setIndex((current) => Math.max(0, current - 1));
          return;
        }
        returningRef.current = true;
        void animate(shift, -1, LAND).then(() => {
          returningRef.current = false;
          pendingArrive.current = 0;
          setIndex((current) => Math.max(0, current - 1));
          void animate(press, 0.975, { duration: 0.07 }).then(() => {
            void animate(press, 1, SETTLE);
          });
        });
        return;
      }
      grab.set(1);
      throwCard(-1, -1800, { x: x.get(), y: y.get(), flip: flip.get() });
    },
    [canNext, canPrev, bump, reduced, shift, press, grab, throwCard, x, y, flip],
  );

  const turn = useCallback(() => {
    if (!word) return;
    if (Math.abs(flip.get() - Math.round(flip.get())) < 0.02) axis.set(0);
    aim.current = Math.round(aim.current) + 1;
    if (reduced) {
      flip.set(aim.current);
      return;
    }
    void animate(flip, aim.current, TURN);
  }, [word, flip, axis, reduced]);

  // Keyboard shortcuts for crisp desktop control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest("input,textarea,button,a")) return;
      if (event.key === " " || event.key === "Enter" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        turn();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if ((event.key === "s" || event.key === "S") && word) {
        event.preventDefault();
        starWords(content.set.id, [word.id], !word.starred).catch((reason) => toast.error(errorMessage(reason)));
      } else if ((event.key === "p" || event.key === "P" || event.key === "a" || event.key === "A") && word) {
        event.preventDefault();
        speak(word.word);
      } else if (event.key === "Escape") {
        event.preventDefault();
        navigate(`/app/sets/${content.set.id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, go, word, content.set.id, navigate]);

  // Pointer gesture handling: tap to flip, drag sideways to throw, drag vertically to spin.
  const gesture = useRef<{
    id: number;
    startX: number;
    startY: number;
    startTime: number;
    turnBase: number;
    mode: "pending" | "swipe" | "spin" | "scroll";
    samples: { x: number; y: number; t: number }[];
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || returningRef.current) return;
    const rect = slotRef.current?.getBoundingClientRect();
    const relY = rect ? event.clientY - rect.top : 0;
    const height = rect?.height || 1;
    const fromMiddle = Math.min(Math.max(1 - (2 * relY) / height, -1), 1);
    grab.set(Math.sign(fromMiddle || 1) * (0.45 + 0.55 * Math.abs(fromMiddle)));
    x.stop();
    y.stop();
    shift.stop();
    if (!reduced) void animate(press, 0.98, SETTLE);
    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      turnBase: flip.get(),
      mode: "pending",
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    g.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    while (g.samples.length > 2 && event.timeStamp - g.samples[0].t > 90) g.samples.shift();

    if (g.mode === "pending") {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) >= Math.abs(dy)) {
        g.mode = "swipe";
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!reduced) {
          void animate(press, 1, SETTLE);
          void animate(lift, 1, SETTLE);
        }
      } else {
        // When the back face has scrollable content, vertical drag scrolls it instead of spinning.
        const scrollEl = backScrollRef.current;
        const backCanScroll =
          flippedSide &&
          scrollEl !== null &&
          scrollEl.scrollHeight > scrollEl.clientHeight + 2 &&
          scrollEl.contains(event.target as Node);
        if (backCanScroll) {
          g.mode = "scroll";
          if (!reduced) void animate(press, 1, SETTLE);
          return;
        }
        g.mode = "spin";
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!reduced) void animate(press, 1, SETTLE);
        if (Math.abs(flip.get() - Math.round(flip.get())) < 0.02) axis.set(1);
      }
    }

    if (g.mode === "swipe") {
      const stageWidth = Math.max(slotRef.current?.clientWidth ?? 420, 320);
      if (!canNext) {
        x.set(dx * 0.22);
        y.set(dy * 0.25);
        shift.set(0);
      } else {
        x.set(dx);
        y.set(dy * 0.25);
        shift.set(Math.min(Math.abs(dx) / (stageWidth * 0.6), 1));
      }
    } else if (g.mode === "spin") {
      flip.set(g.turnBase - dy / TURN_DISTANCE);
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (!reduced) {
      void animate(press, 1, SETTLE);
      void animate(lift, 0, SETTLE);
    }
    if (g.mode === "scroll") return;

    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const dt = Math.max((last.t - first.t) / 1000, 0.016);
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    const dx = event.clientX - g.startX;

    if (g.mode === "pending" && !cancelled) {
      if (event.timeStamp - g.startTime < 350) turn();
      return;
    }

    if (g.mode === "swipe") {
      const thrown =
        !cancelled &&
        (Math.abs(dx) > COMMIT_DISTANCE ||
          (Math.abs(vx) > COMMIT_VELOCITY && Math.sign(vx) === Math.sign(dx)));
      if (canNext && thrown) {
        throwCard(dx < 0 ? -1 : 1, vx, { x: x.get(), y: y.get(), flip: flip.get() });
      } else {
        if (reduced) {
          x.set(0);
          y.set(0);
          shift.set(0);
        } else {
          void animate(x, 0, { ...SETTLE, velocity: vx });
          void animate(y, 0, SETTLE);
          void animate(shift, 0, SETTLE);
        }
      }
    } else if (g.mode === "spin") {
      const speed = -vy / TURN_DISTANCE;
      const target = Math.round(flip.get() + speed * 0.25);
      aim.current = target;
      if (reduced) flip.set(target);
      else void animate(flip, target, { ...TURN, velocity: speed });
    }
  };

  const scatter = useMemo(() => (word ? scatterOf(word.id) : scatterOf("")), [word]);
  const cardTransform = useTransform(
    [x, y, flip, shift, arrive, lift, press, grab],
    ([xv, yv, fv, sv, av, lv, pv, gv]: number[]) => {
      const stageWidth = Math.max(slotRef.current?.clientWidth ?? 420, 320);
      const turning = Math.abs(fv - Math.round(fv)) * 2;
      const lying = piled(Math.max(-sv, 0) + av, scatter);
      const swing = (Math.max(-stageWidth, Math.min(stageWidth, xv)) / stageWidth) * 16 * gv;
      const tx = xv + lying.x;
      const ty = yv + lying.y - turning * 22 - lv * 4;
      const rot = swing + lying.rot;
      const sc = pv * lying.scale;
      return `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(${sc})`;
    },
  );

  const starredCount = content.words.filter((entry) => entry.starred).length;

  return (
    <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-2xl flex-col overscroll-none px-[var(--gutter)] pb-[max(1rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.5rem)] md:pt-[calc(var(--safe-top)+1rem)]">
      <header className="grid h-10 shrink-0 grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-center gap-2">
        <div className="flex items-center">
          <HeaderButton aria-label={`回到 ${content.set.name}`} asChild>
            <AppLink back href={`/app/sets/${content.set.id}`}>
              <X weight="bold" />
            </AppLink>
          </HeaderButton>
        </div>
        <span className="font-latin text-[0.9375rem] font-semibold tabular-nums text-ink">
          {deck.length ? `${at + 1} / ${deck.length}` : "單字卡"}
        </span>
        <div className="flex items-center justify-end gap-1.5">
          <Button
            aria-pressed={shuffle}
            className={cn(shuffle && "bg-accent-soft text-accent-ink hover:bg-accent-soft")}
            onClick={() => {
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
            size="sm"
            variant="ghost"
          >
            <Shuffle weight="bold" />
            隨機
          </Button>
          {starredCount > 0 ? (
            <Button
              aria-pressed={starredOnly}
              className={cn(starredOnly && "bg-accent-soft text-accent-ink hover:bg-accent-soft")}
              onClick={() => {
                setStarredOnly(!starredOnly);
                setIndex(0);
              }}
              size="sm"
              variant="ghost"
            >
              <Star className={cn(starredOnly && "text-highlight")} weight={starredOnly ? "fill" : "regular"} />
              <span className="hidden sm:inline">只看標星</span>
              <span className="font-latin">{starredCount}</span>
            </Button>
          ) : null}
        </div>
      </header>

      {word ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-4">
          <div
            className="relative w-full max-w-[32rem] flex-1 max-h-[34rem] min-h-[18rem] select-none"
            ref={slotRef}
          >
            {pile
              .map((entry, i) => (
                <PileCard
                  arrive={arrive}
                  depth={i + 1}
                  key={entry.id}
                  shift={shift}
                  word={entry}
                />
              ))
              .reverse()}

            <motion.div
              aria-label={`${word.word}，點擊翻面或左右滑動切換`}
              className={cn(
                "absolute inset-0 cursor-grab active:cursor-grabbing",
                !flippedSide && "touch-none",
              )}
              onPointerCancel={(event) => finishPointer(event, true)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => finishPointer(event, false)}
              style={{ transform: cardTransform }}
            >
              <CardFaces
                axis={axis}
                backScrollRef={backScrollRef}
                flip={flip}
                lift={lift}
                word={word}
              />
            </motion.div>

            {previous ? (
              <ReturningCard
                key={previous.id}
                shift={shift}
                side={leftBy[previous.id] ?? -1}
                word={previous}
              />
            ) : null}

            {ghosts.map((ghost) => (
              <FlyingCard
                ghost={ghost}
                key={ghost.key}
                onGone={() => setGhosts((list) => list.filter((entry) => entry.key !== ghost.key))}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SpeakButton size="icon" text={word.word} />
            <StarButton
              setId={content.set.id}
              starred={word.starred}
              word={word.word}
              wordId={word.id}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            action={
              starredOnly ? (
                <Button onClick={() => setStarredOnly(false)}>顯示全部單字</Button>
              ) : (
                <Button asChild variant="primary">
                  <AppLink href={`/app/sets/${content.set.id}/add`}>新增單字</AppLink>
                </Button>
              )
            }
            title={starredOnly ? "沒有標星的單字" : "沒有單字"}
          />
        </div>
      )}

      <nav aria-label="單字卡控制" className="flex shrink-0 items-center justify-center gap-4 pt-1">
        <Button
          aria-label="上一張"
          className="size-13"
          disabled={!canPrev}
          onClick={() => go(-1)}
          size="icon"
          variant="secondary"
        >
          <CaretLeft className="size-5" weight="bold" />
        </Button>
        <Button
          aria-label="翻面"
          className="h-13 px-6"
          disabled={!word}
          onClick={turn}
          size="lg"
          variant="secondary"
        >
          <ArrowsClockwise className="size-5" weight="bold" />
          翻面
          <kbd className="hidden rounded-[0.3rem] bg-surface-raised px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-ink-muted md:inline">
            Space
          </kbd>
        </Button>
        <Button
          aria-label="下一張"
          className="size-13"
          disabled={!canNext}
          onClick={() => go(1)}
          size="icon"
          variant="secondary"
        >
          <CaretRight className="size-5" weight="bold" />
        </Button>
      </nav>
    </div>
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
  shift: MotionValue<number>;
  arrive: MotionValue<number>;
}) {
  const scatter = useMemo(() => scatterOf(word.id), [word.id]);
  const transform = useTransform([shift, arrive], ([sv, av]: number[]) => {
    const d = depth - sv + av;
    const lying = piled(d, scatter);
    return `translate3d(${lying.x}px, ${lying.y}px, 0) rotate(${lying.rot}deg) scale(${lying.scale})`;
  });
  const opacity = useTransform([shift, arrive], ([sv, av]: number[]) => {
    const d = depth - sv + av;
    if (d <= PILE) return 1;
    if (d >= PILE + 0.6) return 0;
    return 1 - (d - PILE) / 0.6;
  });

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[2rem] border border-line bg-surface p-6 shadow-[0_2px_6px_rgb(17_21_18/10%)]"
      style={{ opacity, transform }}
    >
      <span className="line-clamp-2 break-words text-center font-latin text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem]" lang="en">
        {word.word}
      </span>
    </motion.div>
  );
});

/** The previous card flying back onto the pile from the side it was thrown to. */
const ReturningCard = memo(function ReturningCard({
  word,
  side,
  shift,
}: {
  word: Word;
  side: 1 | -1;
  shift: MotionValue<number>;
}) {
  const transform = useTransform(shift, (sv) => {
    const on = Math.min(Math.max(-sv, 0), 1);
    const away = 1 - on;
    const dist = Math.min(window.innerWidth * 1.15, 760);
    const tx = side * dist * away;
    const ty = away * 40 - Math.sin(on * Math.PI) * 34;
    const rot = side * away * 18;
    const sc = 1 + away * 0.06;
    return `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(${sc})`;
  });
  const opacity = useTransform(shift, (sv) => (sv < -0.001 ? 1 : 0));

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[2rem] border border-line bg-surface p-6 shadow-[0_20px_40px_rgb(17_21_18/14%)]"
      style={{ opacity, transform }}
    >
      <span className="line-clamp-2 break-words text-center font-latin text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem]" lang="en">
        {word.word}
      </span>
    </motion.div>
  );
});

/** Both faces of one card, turned in real 3D by `flip` half-turns. */
function CardFaces({
  word,
  flip,
  axis,
  lift,
  backScrollRef,
}: {
  word: Word;
  flip: MotionValue<number>;
  axis: MotionValue<number>;
  lift?: MotionValue<number>;
  backScrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const fallbackLift = useMotionValue(0);
  const activeLift = lift ?? fallbackLift;

  const plateShadow = useTransform([flip, activeLift], ([fv, lv]: number[]) => {
    const turning = Math.abs(fv - Math.round(fv)) * 2;
    const up = Math.max(turning, lv);
    return `0 ${6 + up * 18}px ${16 + up * 30}px rgba(17, 21, 18, ${(0.12 - up * 0.04).toFixed(3)})`;
  });
  const plateTransform = useTransform([flip, axis], ([fv, ax]: number[]) => {
    const angle = faceAngle(fv);
    const lean = Math.abs(Math.cos((angle * Math.PI) / 180));
    const turning = Math.abs(fv - Math.round(fv)) * 2;
    const narrow = Math.max(lean * (1 - turning * 0.08), 0.02);
    return ax === 1 ? `scaleY(${narrow})` : `scaleX(${narrow})`;
  });

  const frontTransform = useTransform([flip, axis], ([fv, ax]: number[]) => {
    const local = signed(faceAngle(fv));
    if (Math.abs(local) < 0.05) return "none";
    return `perspective(${PERSPECTIVE}px) ${ax === 1 ? `rotateX(${local}deg)` : `rotateY(${local}deg)`}`;
  });
  const frontOpacity = useTransform(flip, (fv) => (Math.abs(signed(faceAngle(fv))) < 90 ? 1 : 0));
  const frontShade = useTransform(flip, (fv) => {
    const local = signed(faceAngle(fv));
    return (1 - Math.abs(Math.cos((local * Math.PI) / 180))) * 0.28;
  });

  const backTransform = useTransform([flip, axis], ([fv, ax]: number[]) => {
    const local = signed(faceAngle(fv) - 180);
    if (Math.abs(local) < 0.05) return "none";
    return `perspective(${PERSPECTIVE}px) ${ax === 1 ? `rotateX(${local}deg)` : `rotateY(${local}deg)`}`;
  });
  const backOpacity = useTransform(flip, (fv) => (Math.abs(signed(faceAngle(fv) - 180)) <= 90 ? 1 : 0));
  const backShade = useTransform(flip, (fv) => {
    const local = signed(faceAngle(fv) - 180);
    return (1 - Math.abs(Math.cos((local * Math.PI) / 180))) * 0.28;
  });

  const original = word.senses.filter((sense) => !sense.supplementary);
  const extra = word.senses.filter((sense) => sense.supplementary);

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem]"
        style={{ boxShadow: plateShadow, transform: plateTransform }}
      />

      {/* Front face */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[2rem] border border-line bg-surface p-7"
        style={{
          backfaceVisibility: "hidden",
          opacity: frontOpacity,
          transform: frontTransform,
        }}
      >
        <p className="line-clamp-3 break-words text-center font-latin text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem]" lang="en">
          {word.word}
        </p>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: frontShade }}
        />
      </motion.div>

      {/* Back face */}
      <motion.div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface p-6"
        style={{
          backfaceVisibility: "hidden",
          opacity: backOpacity,
          transform: backTransform,
        }}
      >
        <p className="shrink-0 truncate text-center font-latin text-lg font-semibold text-ink-muted" lang="en">
          {word.word}
        </p>
        <div
          className="edge-fade mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
          ref={backScrollRef}
        >
          <div className="grid gap-4 px-1">
            {original.map((sense) => (
              <SenseBlock key={sense.id} sense={sense} />
            ))}
            {extra.length ? (
              <div className="grid gap-3 border-t border-line pt-3.5">
                <div className="justify-self-start">
                  <Chip tone="info">補充</Chip>
                </div>
                {extra.map((sense) => (
                  <SenseBlock key={sense.id} sense={sense} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: backShade }}
        />
      </motion.div>
    </>
  );
}

/** A thrown card carrying on from where the pointer let go and flying off screen. */
function FlyingCard({ ghost, onGone }: { ghost: Ghost; onGone: () => void }) {
  const x = useMotionValue(ghost.x);
  const y = useMotionValue(ghost.y);
  const flip = useMotionValue(ghost.flip);
  const axis = useMotionValue(ghost.axis);
  const lift = useMotionValue(1);

  useEffect(() => {
    const travel = Math.max(window.innerWidth * 1.1, 680);
    const target = ghost.side * travel;
    const xAnim = animate(x, target, { ...THROW, velocity: ghost.velocity });
    const yAnim = animate(y, ghost.y * 2 + 40, THROW);
    const fAnim = animate(flip, Math.round(ghost.flip), TURN);
    void xAnim.then(onGone);
    return () => {
      xAnim.stop();
      yAnim.stop();
      fAnim.stop();
    };
    // Runs once: the card is already in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transform = useTransform([x, y], ([xv, yv]: number[]) => {
    const span = Math.max(window.innerWidth, 420);
    const rot = (Math.max(-span, Math.min(span, xv)) / span) * 16 * ghost.grab;
    return `translate3d(${xv}px, ${yv}px, 0) rotate(${rot}deg)`;
  });

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ transform }}
    >
      <CardFaces axis={axis} flip={flip} lift={lift} word={ghost.word} />
    </motion.div>
  );
}

function SenseBlock({ sense }: { sense: Word["senses"][number] }) {
  const points = descriptionPoints(sense.description);
  return (
    <div className="grid gap-1.5">
      <p className="text-[1.125rem] font-semibold leading-snug text-ink">
        <span className="mr-1.5 font-latin text-[0.9375rem] font-medium text-ink-muted">{sense.pos}</span>
        {sense.meaning}
      </p>
      {points.length ? (
        <ul className="grid gap-1 text-[0.9375rem] leading-relaxed text-ink-muted">
          {points.map((point, index) => (
            <li className="flex gap-1.5" key={index}>
              <span aria-hidden className="text-ink-faint">•</span>
              <span className="min-w-0">{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
