import * as React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiquidNav } from "@/components/liquid-nav";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import {
  adoptedParent,
  consumeRouteDirection,
  isRootRoute,
  rememberRoutePath,
} from "@/lib/navigation-memory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    transitionTypes: _types,
    ...props
  }: React.ComponentProps<"a"> & { transitionTypes?: string[] }) => (
    <a {...props} onClick={(event) => event.preventDefault()} />
  ),
  useLinkStatus: () => ({ pending: false }),
}));
afterEach(cleanup);

describe("navigation selection", () => {
  const items = [
    { href: "/app", icon: null, label: "Home" },
    { href: "/app/library", icon: null, label: "Library" },
    { href: "/app/me", icon: null, label: "Account" },
  ];
  it("keeps the actual page selected through cancelled touches and modified clicks", () => {
    const screen = render(<LiquidNav items={items} pathname="/app" />);
    fireEvent.pointerDown(screen.getByText("Library"), {
      pointerType: "touch",
    });
    fireEvent.pointerCancel(screen.getByText("Library"), {
      pointerType: "touch",
    });
    fireEvent.click(screen.getByText("Account"), { ctrlKey: true });
    expect(screen.getByText("Home").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Library").closest("a")).not.toHaveAttribute(
      "aria-current",
    );
    screen.rerender(<LiquidNav items={items} pathname="/app/library" />);
    expect(screen.getByText("Library").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    screen.rerender(<LiquidNav items={items} pathname="/app" />);
    expect(screen.getByText("Home").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
  it("does not move a controlled tab's selection before its value changes", () => {
    const screen = render(
      <LiquidTabs
        ariaLabel="Mode"
        value="words"
        onValueChange={vi.fn()}
        options={[
          { value: "words", label: "Words" },
          { value: "questions", label: "Questions" },
        ]}
      />,
    );
    fireEvent.pointerDown(screen.getByRole("tab", { name: "Questions" }), {
      pointerType: "touch",
    });
    fireEvent.pointerCancel(screen.getByRole("tab", { name: "Questions" }), {
      pointerType: "touch",
    });
    expect(screen.getByRole("tab", { name: "Words" })).toHaveAttribute(
      "data-displayed-active",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Questions" })).toHaveAttribute(
      "data-displayed-active",
      "false",
    );
  });
  it("treats the four primary destinations as peers and retains their child ownership", () => {
    for (const from of ["/app", "/app/library", "/app/progress", "/app/me"]) {
      rememberRoutePath(from);
      for (const to of ["/app", "/app/library", "/app/progress", "/app/me"]) {
        expect(consumeRouteDirection(to)).toBe("root");
      }
    }
    rememberRoutePath("/app");
    expect(consumeRouteDirection("/app/practice")).toBe("child");
    rememberRoutePath("/app/library");
    expect(consumeRouteDirection("/app/sets/example")).toBe("child");
    expect(adoptedParent("/app/sets/example")).toBe("/app/library");
    expect(adoptedParent("/app/sync")).toBe("/app/me");
    expect(adoptedParent("/app/me/preferences")).toBe("/app/me");
  });
  it("pushes into a page the destination it was opened from does not own", () => {
    // A set reached from 今天 is filed under the Library, and reading that as a
    // branch switch left the first set of a session with no animation while
    // every one opened afterwards — from the Library, after a back — had one.
    rememberRoutePath("/app");
    expect(consumeRouteDirection("/app/sets/example")).toBe("child");
    rememberRoutePath("/app/sets/example");
    expect(consumeRouteDirection("/app/me")).toBe("back");
    rememberRoutePath("/app/me");
    expect(consumeRouteDirection("/app/sync")).toBe("child");
    rememberRoutePath("/app/me/admin");
    expect(consumeRouteDirection("/app/me/admin/usage")).toBe("child");
  });
  it("names the destinations primary navigation points at", () => {
    for (const destination of ["/app", "/app/library", "/app/progress", "/app/me"]) {
      expect(isRootRoute(destination)).toBe(true);
    }
    // A screen you arrive at from a destination is not one of them, however
    // shallow its URL looks.
    expect(isRootRoute("/app/practice")).toBe(false);
    expect(isRootRoute("/app/sync")).toBe(false);
    expect(isRootRoute("/app/sets/example")).toBe(false);
    expect(isRootRoute("/app/questions/generate")).toBe(false);
  });
});
