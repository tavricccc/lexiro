import { cn } from "../lib/utils";

/**
 * A fade along one edge of the screen: content passing under it dissolves into
 * the page colour (`--edge-fade`, the canvas by default) instead of meeting a hard cut.
 */
export function EdgeBlur({ className, side }: { className?: string; side: "top" | "bottom" }) {
  return (
    <div aria-hidden className={cn("edge-blur pointer-events-none fixed inset-x-0 z-20", side === "top" ? "top-0" : "bottom-0", className)} data-side={side} />
  );
}
