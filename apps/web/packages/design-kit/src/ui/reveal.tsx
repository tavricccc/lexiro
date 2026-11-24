import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { timing } from "../lib/motion-timing";
import { cn } from "../lib/utils";

/**
 * A block that comes and goes inside a page: it opens its own space and closes
 * it again, so what is around it moves instead of jumping. `gap` is the space
 * the parent grid leaves around it, given back while it is closed.
 */
export function RevealItem({ children, className, gap = "0px" }: { children: React.ReactNode; className?: string; gap?: string }) {
  const still = useReducedMotion();
  const closed = { opacity: 0, ...(still ? {} : { height: 0, marginTop: gap === "0px" ? 0 : `calc(${gap} * -1)` }) };
  return (
    <motion.div
      animate={{ opacity: 1, height: "auto", marginTop: 0 }}
      className={cn("min-w-0", className)}
      exit={closed}
      initial={closed}
      style={{ overflow: "clip", overflowClipMargin: "1.5rem" }}
      transition={timing("control", "move")}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({ children, className, gap, open }: { children: React.ReactNode; className?: string; gap?: string; open: boolean }) {
  return <AnimatePresence initial={false}>{open ? <RevealItem className={className} gap={gap}>{children}</RevealItem> : null}</AnimatePresence>;
}

/**
 * The last value that was there. What a layer says should still be said while
 * the layer closes, after the choice that opened it is gone.
 */
export function useLast<T>(value: T | null | undefined): T | null {
  const [last, setLast] = React.useState<T | null>(value ?? null);
  if (value != null && value !== last) setLast(value);
  return value ?? last;
}
