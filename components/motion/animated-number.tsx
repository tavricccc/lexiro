"use client";

import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/cn";

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
