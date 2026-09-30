"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  consumeRouteDirection,
  consumeViewDirection,
} from "@/lib/navigation-memory";
import { cn } from "@/lib/cn";

const DIRECTIONS = {
  back: "pop",
  child: "push",
  root: "none",
} as const;

/** Reveals ready route content and in-place flow steps without blocking input. */
export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const previous = useRef("");
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = surface.current!;
    const routeDirection = consumeRouteDirection(pathname);
    const navigation = Boolean(
      previous.current && previous.current !== pathname,
    );
    previous.current = pathname;
    consumeViewDirection();
    let identity: string | null = null;
    let animation: Animation | undefined;
    let contentAnimation: Animation | undefined;
    let waiting = !node.querySelector("[data-motion-view], [role='alert']");
    const slide = (direction: keyof typeof DIRECTIONS) => {
      node.dataset.routeDirection = DIRECTIONS[direction];
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animation?.cancel();
      const transform =
        direction === "root"
          ? "translateY(12px)"
          : `translateX(${direction === "back" ? -56 : 56}px)`;
      animation = node.animate(
        [
          { opacity: 0, transform },
          { opacity: 1, transform: "none" },
        ],
        { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    };
    if (navigation) slide(routeDirection);
    const reveal = () => {
      const view = node.querySelector("[data-motion-view], [role='alert']");
      if (!view) {
        waiting = true;
        return;
      }
      const nextIdentity =
        view.getAttribute("data-motion-view") ?? view.textContent;
      if (waiting) {
        waiting = false;
        identity = nextIdentity;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          contentAnimation?.cancel();
          contentAnimation = content.current!.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: 180, easing: "ease-out" },
          );
        }
        return;
      }
      if (nextIdentity === identity) return;
      const firstContent = identity === null;
      identity = nextIdentity;
      if (!firstContent) slide(consumeViewDirection());
    };
    // The route moves once, including any local loading phase. Loaded content
    // fades within that surface instead of restarting the whole-page slide.
    const observer = new MutationObserver(reveal);
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    reveal();
    return () => {
      observer.disconnect();
      animation?.cancel();
      contentAnimation?.cancel();
    };
  }, [pathname]);

  return (
    <div
      ref={surface}
      key={pathname}
      className={cn("route-page", className)}
      data-route-path={pathname}
    >
      <div ref={content} className="route-content">
        {children}
      </div>
    </div>
  );
}
