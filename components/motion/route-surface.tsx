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
    const reveal = () => {
      const view = node.querySelector("[data-motion-view], [role='alert']");
      if (!view) return;
      const nextIdentity =
        view.getAttribute("data-motion-view") ?? view.textContent;
      if (nextIdentity === identity) return;
      const firstContent = identity === null;
      identity = nextIdentity;
      const direction = firstContent ? routeDirection : consumeViewDirection();
      node.dataset.routeDirection = DIRECTIONS[direction];
      if (firstContent && !navigation) return;
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
    // Loading placeholders have no view marker. Reveal the actual screen once
    // it arrives, and repeat for in-place flow steps and their return controls.
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
    };
  }, [pathname]);

  return (
    <div
      ref={surface}
      key={pathname}
      className={cn("route-page", className)}
      data-route-path={pathname}
    >
      {children}
    </div>
  );
}
