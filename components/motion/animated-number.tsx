"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/cn";

/**
 * A number that changed while the user was looking at it rolls to its new
 * value: the old one leaves upward, the new one arrives from below.
 *
 * The whole value moves as one. Animating each digit on its own delay turns a
 * count going from 9 to 10 into a small piece of choreography, which is a lot
 * of attention to spend on a number nobody asked to watch.
 */
export function AnimatedNumber({
  className,
  value,
}: {
  className?: string;
  value: number | string;
}) {
  const text = String(value);
  return (
    <span
      aria-label={text}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden tabular-nums whitespace-nowrap",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          aria-hidden
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex whitespace-nowrap"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 8 }}
          key={text}
          transition={timing("control")}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A total that grew counts up to its new value, so a score visibly gains what
 * was won. `from` is where the first render starts: 0 makes a result screen
 * tally its number, while leaving it out shows the first value as is.
 */
export function CountUp({
  className,
  format = String,
  from,
  value,
}: {
  className?: string;
  format?: (value: number) => string;
  from?: number;
  value: number;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(from ?? value);
  // React writes the text once; after that the animation owns it, so a new
  // value never flashes in ahead of its own count.
  const [initial] = useState(() => format(from ?? value));
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const start = shown.current;
    shown.current = value;
    if (
      start === value ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      element.textContent = format(value);
      return;
    }
    const controls = animate(start, value, {
      ...timing("sheet"),
      onUpdate: (latest) => {
        element.textContent = format(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [format, value]);
  return (
    <span aria-label={format(value)} className={cn("tabular-nums", className)}>
      <span aria-hidden ref={node}>
        {initial}
      </span>
    </span>
  );
}

export function AnimatedText({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  return (
    <span className={cn("inline-grid overflow-hidden", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="col-start-1 row-start-1"
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          key={text}
          transition={timing("control")}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
