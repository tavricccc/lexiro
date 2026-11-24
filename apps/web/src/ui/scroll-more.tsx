import { useEffect, useState, type RefObject } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "design-kit";

/** Less than this below the fold is not worth an arrow. */
const SLACK = 12;

const px = (value: string) => Number.parseFloat(value) || 0;

/** Space after the last of the content. Scrolling only that into view shows nothing new. */
function blankAfter(element: HTMLElement) {
  const last = [...element.children].findLast((child) => child instanceof HTMLElement && getComputedStyle(child).position !== "absolute");
  return px(getComputedStyle(element).paddingBottom) + (last ? px(getComputedStyle(last).paddingBottom) : 0);
}

/**
 * A down arrow shown while there is content left below; pressing it goes to
 * the end. It follows the window, or the scrolling element given. Its place is
 * the caller's: `className` carries the position.
 */
export function ScrollMore({ target, className }: { target?: RefObject<HTMLElement | null>; className?: string }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = target ? target.current : document.documentElement;
    if (!element) return;
    const content = target ? element : document.body;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const left = element.scrollHeight - element.clientHeight - element.scrollTop;
      setMore(left > SLACK && left - blankAfter(content) > SLACK);
    };
    const queue = () => { frame ||= requestAnimationFrame(measure); };
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(queue);
    const watch = () => {
      sizes?.disconnect();
      sizes?.observe(element);
      for (const child of content.children) {
        sizes?.observe(child);
        for (const inner of child.children) sizes?.observe(inner);
      }
      queue();
    };
    watch();
    const source = target ? element : window;
    source.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // The content itself is swapped when it loads or its view changes.
    const changes = new MutationObserver(watch);
    changes.observe(content, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      source.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      sizes?.disconnect();
      changes.disconnect();
    };
  }, [target]);
  const toEnd = () => {
    const element = target ? target.current : document.documentElement;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    element?.scrollTo({ top: element.scrollHeight, behavior });
  };
  return (
    <button
      aria-label="捲到最底"
      className={cn(
        "glass-float z-30 grid size-11 place-items-center rounded-full text-lg text-ink outline-none transition-[opacity,scale] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-[0.94]",
        !more && "pointer-events-none scale-75 opacity-0",
        className,
      )}
      inert={!more}
      onClick={toEnd}
      type="button"
    >
      <CaretDown weight="bold" />
    </button>
  );
}
