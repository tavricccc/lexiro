import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

// The card's green, ink, the brighter green of a right answer, and gold.
const PALETTE = [
  "#7cc49c",
  "var(--foreground)",
  "var(--success)",
  "#c6dfd1",
  "#ffd23f",
];

interface Spark {
  dx: number;
  dy: number;
  size: number;
  round: boolean;
  spin: number;
  color: string;
}

function sparks(count: number, reach: number): Spark[] {
  return Array.from({ length: count }, (_, index) => {
    // Evenly spread with a little jitter, so the burst never leaves a gap.
    const angle =
      (index / count) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI / count);
    const distance = reach * (0.55 + Math.random() * 0.45);
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 5 + Math.random() * 5,
      round: index % 3 !== 0,
      spin: (Math.random() - 0.5) * 540,
      color: PALETTE[index % PALETTE.length]!,
    };
  });
}

/**
 * The app's confetti: one short burst from the centre of its parent, which
 * must be positioned. It plays once on mount, takes no pointer events, and
 * draws nothing when the reader asks for reduced motion.
 */
export function ParticleBurst({
  count = 16,
  reach = 64,
}: {
  count?: number;
  reach?: number;
}) {
  const reduced = useReducedMotion();
  const [list] = useState(() => sparks(count, reach));
  if (reduced) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 size-0 overflow-visible"
    >
      {list.map((spark, index) => (
        <motion.span
          animate={{
            x: [0, spark.dx],
            // Each spark flies out, then falls a little as it fades.
            y: [0, spark.dy + 26],
            rotate: [0, spark.spin],
            scale: [1, 0.5],
            opacity: [1, 1, 0],
          }}
          className="absolute"
          initial={false}
          key={index}
          style={{
            width: spark.size,
            height: spark.round ? spark.size : spark.size * 0.45,
            borderRadius: spark.round ? spark.size / 2 : 1.5,
            marginLeft: -spark.size / 2,
            marginTop: -spark.size / 2,
            backgroundColor: spark.color,
          }}
          transition={{
            duration: 0.72,
            ease: "easeOut",
            opacity: { duration: 0.72, times: [0, 0.55, 1] },
          }}
        />
      ))}
    </span>
  );
}
