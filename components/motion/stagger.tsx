"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/cn";

/**
 * A list whose rows animate only once the list itself is already on screen.
 *
 * `initial={false}` is the whole point: the rows a list is born with do not
 * animate. iOS never animates a table view's first paint, and animating it here
 * means every navigation arrives at a page that is still assembling itself,
 * underneath a route transition that had already delivered it.
 *
 * The element is a choice because the lists it wraps are real lists: a listing
 * that became a stack of divs to gain an animation would have traded the thing
 * a screen reader announces for the thing a sighted user barely notices.
 */
export function StaggerList({
  as = "div",
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  as?: "div" | "ol" | "ul";
  children: ReactNode;
}) {
  // The element is chosen at the call site, so its props are the intersection
  // of every element it can be; the attributes a list actually takes are the
  // ones any of them take.
  const Element = as as "div";
  return (
    <Element className={cn("t-stagger-list relative", className)} {...props}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </Element>
  );
}

// Rows added or removed later hand over on opacity alone, on one rung, with no
// stagger between them: blurring or displacing each row makes an ordinary
// re-render read as a reload, and delaying each row by its index makes the row
// the user was reaching for the last one to arrive.
export function StaggerItem({
  as = "div",
  className,
  ...props
}: ComponentProps<typeof motion.div> & { as?: "div" | "li" }) {
  const Element = (as === "li" ? motion.li : motion.div) as typeof motion.div;
  return (
    <Element
      className={cn("t-stagger-item", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={timing("control")}
      {...props}
    />
  );
}
