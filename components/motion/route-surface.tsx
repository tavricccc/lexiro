"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { consumeRouteDirection } from "@/lib/navigation-memory";
import { cn } from "@/lib/cn";

const DIRECTIONS = {
  back: "pop",
  child: "push",
  root: "none",
} as const;

/**
 * The surface every route is painted on.
 *
 * Only the page that arrives animates, and it animates in the live document.
 * Capturing the document instead — a view transition — buys the page being left
 * a parallax, and costs a full rasterisation of both pages at the moment the
 * browser is already fetching, rendering and hydrating the route that was asked
 * for. It also suspends hit testing for the length of the animation, which is
 * what used to swallow a tap on the dock.
 *
 * The direction is written onto the page that arrives rather than onto the
 * document, because it is that page's own animation: published on an ancestor
 * it would retune an animation that had already begun.
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
    // The first page of a session arrived with the document; animating it would
    // make the app look like it was still assembling itself.
    if (surface.current && previous.current) {
      surface.current.dataset.routeDirection = direction;
    }
    previous.current = pathname;
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
