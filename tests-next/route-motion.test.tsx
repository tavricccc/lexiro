import * as React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RouteSurface } from "@/components/motion/route-surface";
import { markViewDirection, rememberRoutePath } from "@/lib/navigation-memory";

const route = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
const animate = vi.fn(
  (_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
    cancel: vi.fn(),
  }),
);

beforeEach(() => {
  route.pathname = "/app";
  rememberRoutePath("/app");
  animate.mockClear();
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("waits for actual practice content instead of spending the transition on its skeleton", async () => {
  const screen = render(
    <RouteSurface>
      <header data-motion-view="Today" />
    </RouteSurface>,
  );
  route.pathname = "/app/practice";
  screen.rerender(
    <RouteSurface>
      <div aria-busy="true">Loading</div>
    </RouteSurface>,
  );
  expect(animate).not.toHaveBeenCalled();
  screen.rerender(
    <RouteSurface>
      <header data-motion-view="Practice setup" />
    </RouteSurface>,
  );
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  expect(animate.mock.calls[0][0][0].transform).toBe("translateX(56px)");
});

it("animates both an in-place return and a return to the parent route backwards", async () => {
  route.pathname = "/app/practice";
  rememberRoutePath(route.pathname);
  const screen = render(
    <RouteSurface>
      <div data-motion-view="practice-session" />
    </RouteSurface>,
  );
  markViewDirection("back");
  screen.rerender(
    <RouteSurface>
      <header data-motion-view="Practice setup" />
    </RouteSurface>,
  );
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  expect(animate.mock.calls[0][0][0].transform).toBe("translateX(-56px)");
  route.pathname = "/app";
  screen.rerender(
    <RouteSurface>
      <header data-motion-view="Today" />
    </RouteSurface>,
  );
  expect(animate).toHaveBeenCalledTimes(2);
  expect(animate.mock.calls[1][0][0].transform).toBe("translateX(-56px)");
});

it("respects reduced motion when navigating to a ready screen", () => {
  const media = window.matchMedia("");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
  const screen = render(
    <RouteSurface>
      <header data-motion-view="Today" />
    </RouteSurface>,
  );
  route.pathname = "/app/practice";
  screen.rerender(
    <RouteSurface>
      <header data-motion-view="Practice setup" />
    </RouteSurface>,
  );
  expect(animate).not.toHaveBeenCalled();
});
