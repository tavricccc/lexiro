import { ArrowsDownUp, Shuffle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DescriptionPoints } from "@/components/library/description-points";
import type { ViewWord } from "@/components/library/set-word-row";
import { SpeakButton } from "@/components/redesign/primitives";
import { StarButton } from "@/components/ui/star-button";
import { t } from "@/lib/i18n";

export function WordCardStack({
  words,
  compact = false,
  title,
}: {
  words: ViewWord[];
  compact?: boolean;
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [sendingBack, setSendingBack] = useState<"up" | "down" | null>(null);

  const deck = useMemo(() => {
    if (!shuffled || words.length <= 1) return words;
    const copy = [...words];
    // Deterministic-feel Fisher-Yates shuffle when toggled
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = (i * 17 + 7) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [shuffled, words]);

  const safeIndex = deck.length ? index % deck.length : 0;

  useEffect(() => {
    setFlipped(false);
  }, [safeIndex, deck]);

  const gesture = useRef<{
    pointerId: number;
    startY: number;
    startX: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);

  if (!deck.length) return null;

  const advance = (direction: "up" | "down") => {
    if (deck.length <= 1 || sendingBack) {
      setDragY(0);
      return;
    }
    setSendingBack(direction);
    setDragY(direction === "up" ? -120 : 120);
    window.setTimeout(() => {
      setIndex((current) =>
        direction === "up"
          ? (current + 1) % deck.length
          : (current - 1 + deck.length) % deck.length,
      );
      setFlipped(false);
      setSendingBack(null);
      setDragY(0);
    }, 180);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, [data-no-card-drag]")
    ) {
      return;
    }
    gesture.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore synthetic events in tests
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const dy = event.clientY - state.startY;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
    state.moved = true;

    const now = performance.now();
    const dt = Math.max(1, now - state.lastTime);
    state.velocityY = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastTime = now;

    setDragY(Math.max(-160, Math.min(160, dy)));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    gesture.current = null;
    if (!state || event.pointerId !== state.pointerId) return;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore
    }

    const dy = event.clientY - state.startY;
    if (!state.moved || Math.abs(dy) < 8) {
      setDragY(0);
      setFlipped((open) => !open);
      return;
    }

    if (dy < -52 || (dy < -20 && state.velocityY < -0.35)) {
      advance("up");
    } else if (dy > 52 || (dy > 20 && state.velocityY > 0.35)) {
      advance("down");
    } else {
      setDragY(0);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setFlipped((open) => !open);
    } else if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      advance("up");
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      advance("down");
    }
  };

  const visibleDepth = Math.min(3, deck.length);
  const stackItems = Array.from({ length: visibleDepth }, (_, depth) => {
    const itemIndex = (safeIndex + depth) % deck.length;
    return {
      depth,
      itemIndex,
      entry: deck[itemIndex],
    };
  }).reverse();

  return (
    <section
      className="card-stack-section"
      aria-label={title ?? t("setDetail.cardStack")}
    >
      {!compact && (
        <div className="card-stack-header">
          <div className="rowx">
            <span className="chip">
              <ArrowsDownUp size={14} weight="bold" />
              {title ?? t("setDetail.cardStack")}
            </span>
            <span className="muted latin text-sm font-semibold">
              {safeIndex + 1} / {deck.length}
            </span>
          </div>
          {deck.length > 1 && (
            <button
              type="button"
              className="chip"
              aria-pressed={shuffled}
              onClick={() => {
                setShuffled((value) => !value);
                setIndex(0);
              }}
            >
              <Shuffle size={14} weight="bold" />
              {t("setDetail.shuffleCards")}
            </button>
          )}
        </div>
      )}

      <div className="card-stack-stage">
        {stackItems.map(({ depth, entry, itemIndex }) => {
          const isTop = depth === 0;
          const progress = Math.min(1, Math.abs(dragY) / 140);
          const targetScale = isTop
            ? sendingBack
              ? 0.88
              : 1 - progress * 0.04
            : 1 - depth * 0.045 + progress * 0.045;
          const targetY = isTop
            ? dragY
            : depth * 11 - progress * 11;
          const targetZIndex = isTop && sendingBack ? 0 : 10 - depth;
          const targetOpacity =
            isTop && sendingBack ? 0.35 : 1 - depth * 0.14;

          return (
            <motion.div
              key={`${entry.wordKey}:${itemIndex}`}
              className="card-stack-item"
              data-depth={depth}
              data-open={isTop && flipped ? "" : undefined}
              role={isTop ? "button" : undefined}
              tabIndex={isTop ? 0 : -1}
              aria-label={isTop ? entry.word : undefined}
              style={{ zIndex: targetZIndex }}
              animate={{
                y: targetY,
                scale: targetScale,
                opacity: targetOpacity,
              }}
              transition={
                isTop && dragY !== 0 && !sendingBack
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 380, damping: 30 }
              }
              onPointerDown={isTop ? handlePointerDown : undefined}
              onPointerMove={isTop ? handlePointerMove : undefined}
              onPointerUp={isTop ? handlePointerEnd : undefined}
              onPointerCancel={isTop ? handlePointerEnd : undefined}
              onKeyDown={isTop ? handleKeyDown : undefined}
            >
              <div className="card-stack-top">
                <div className="rowx">
                  <span className="chip font-latin">
                    {entry.senses
                      .map((s) => s.pos)
                      .filter(Boolean)
                      .join(" · ") || "word"}
                  </span>
                  {compact && (
                    <span className="muted latin text-xs font-semibold">
                      {safeIndex + 1}/{deck.length}
                    </span>
                  )}
                </div>
                <div
                  className="card-stack-actions"
                  data-no-card-drag=""
                  onClick={(e) => e.stopPropagation()}
                >
                  <StarButton wordKey={entry.wordKey} />
                  <SpeakButton text={entry.word} />
                </div>
              </div>

              <div className="card-stack-body">
                {!isTop || !flipped ? (
                  <p className="card-stack-word">{entry.word}</p>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    <p className="font-latin text-base font-bold text-muted-foreground">
                      {entry.word}
                    </p>
                    {entry.senses.map((sense) => {
                      const example = sense.examples.find((ex) => ex.trim());
                      return (
                        <div key={sense.id} className="set-word-sense">
                          <p className="card-stack-meaning">
                            <span className="set-word-pos font-latin">
                              {sense.pos}
                            </span>{" "}
                            {sense.meaningZh}
                          </p>
                          {sense.description?.trim() && (
                            <DescriptionPoints
                              text={sense.description}
                              max={2}
                              className="set-word-note"
                              pointClassName="line-clamp-1"
                            />
                          )}
                          {example && (
                            <p
                              className="set-word-example font-latin line-clamp-1"
                              lang="en"
                            >
                              {example}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card-stack-foot">
                <span>{t("setDetail.flipCard")}</span>
                {deck.length > 1 && (
                  <span>{t("setDetail.swipeHint")}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
