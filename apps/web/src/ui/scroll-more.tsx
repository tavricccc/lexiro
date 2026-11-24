import { useEffect, useState, type RefObject } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "design-kit";

/** Less than this below the fold is only padding. */
const SLACK = 24;

/**
 * A down arrow shown while a page goes on below; pressing it moves one page on.
 * It follows the window, or the scrolling element given. Its place is the
 * caller's: `className` carries the position.
 */
export function ScrollMore({ target, className }: { target?: RefObject<HTMLElement | null>; className?: string }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = target ? target.current : document.documentElement;
    if (!element) return;
    const measure = () => setMore(element.scrollHeight - element.clientHeight - element.scrollTop > SLACK);
    measure();
    const source = target ? element : window;
    source.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    sizes?.observe(target ? element : document.body);
    const content = new MutationObserver(measure);
    if (target) content.observe(element, { childList: true, subtree: true, characterData: true });
    return () => {
      source.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      sizes?.disconnect();
      content.disconnect();
    };
  }, [target]);
  const scrollOn = () => {
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (target) target.current?.scrollBy({ top: target.current.clientHeight * 0.7, behavior });
    else window.scrollBy({ top: window.innerHeight * 0.7, behavior });
  };
  return (
    <button
      aria-label="往下捲"
      className={cn(
        "glass-float z-30 grid size-11 place-items-center rounded-full text-lg text-ink outline-none transition-opacity duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        !more && "pointer-events-none opacity-0",
        className,
      )}
      inert={!more}
      onClick={scrollOn}
      type="button"
    >
      <CaretDown weight="bold" />
    </button>
  );
}
