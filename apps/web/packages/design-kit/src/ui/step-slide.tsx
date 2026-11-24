import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { stepMotion } from "../lib/route-motion";
import { cn } from "../lib/utils";

/**
 * A run of steps, each in the last one's place: the next question pushes in
 * from the right, looking back brings the one before from the left. A step
 * that is leaving stays as it was.
 */
export function StepSlide({ children, className, direction, step }: {
  children: React.ReactNode;
  className?: string;
  /** 1 onwards, -1 back, 0 for a plain fade. */
  direction: -1 | 0 | 1;
  step: string | number;
}) {
  const still = useReducedMotion();
  const way = still ? 0 : direction;
  return (
    <div className={cn("relative overflow-x-clip", className)}>
      <AnimatePresence custom={way} initial={false} mode="popLayout">
        <motion.div animate="rest" className="flex min-h-0 w-full flex-1 flex-col" custom={way} exit="leave" initial="enter" key={step} variants={stepMotion}>
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
