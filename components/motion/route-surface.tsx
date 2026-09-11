"use client";

import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { consumeRouteDirection } from "@/lib/navigation-memory";
import { cn } from "@/lib/cn";

const DIRECTIONS = {
  back: "pop",
  child: "push",
  root: "none",
} as const;

/**
 * The surface every route is painted on, and the participant in the push and
 * pop recipes in the stylesheet.
 *
 * The direction is published on the document rather than passed to
 * <ViewTransition> because the surface that leaves keeps the props it last
 * rendered with, which predate this navigation. React runs layout effects
 * inside the view transition's update callback, so the attribute is in place
 * before the browser captures the new snapshot and starts the animations.
 */
export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const previous = useRef("");

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.documentElement.dataset.navDirection =
      DIRECTIONS[consumeRouteDirection(pathname)];
  }, [pathname]);

  return (
    <ViewTransition
      default="none"
      enter="t-route-in"
      exit="t-route-out"
      key={pathname}
    >
      <div className={cn("route-page", className)} data-route-path={pathname}>
        {children}
      </div>
    </ViewTransition>
  );
}
