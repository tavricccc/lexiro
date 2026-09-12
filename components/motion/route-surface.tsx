"use client";

import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { consumeRouteDirection, isRootRoute } from "@/lib/navigation-memory";
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
  const surface = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    const direction = DIRECTIONS[consumeRouteDirection(pathname)];
    document.documentElement.dataset.navDirection = direction;
    if (surface.current && previous.current && direction === "none") {
      surface.current.dataset.routeEntry = "replace";
    }
    previous.current = pathname;
  }, [pathname]);

  const content = (
    <div
      ref={surface}
      key={pathname}
      className={cn("route-page", className)}
      data-route-path={pathname}
    >
      {children}
    </div>
  );

  // Keep primary pages outside the document snapshot lifecycle so even its
  // capture phase cannot swallow the next navigation gesture.
  if (isRootRoute(pathname)) return content;

  return (
    <ViewTransition
      default="none"
      enter="t-route-in"
      exit="t-route-out"
      key={pathname}
    >
      {content}
    </ViewTransition>
  );
}
