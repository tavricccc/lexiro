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
    { href: "/", icon: null, label: "Home" },
    { href: "/library", icon: null, label: "Library" },
    { href: "/me", icon: null, label: "Account" },
  ];
  it("keeps the actual page selected through cancelled touches and modified clicks", () => {
    const screen = render(<LiquidNav items={items} pathname="/" />);
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
    screen.rerender(<LiquidNav items={items} pathname="/library" />);
    expect(screen.getByText("Library").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    screen.rerender(<LiquidNav items={items} pathname="/" />);
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
    for (const from of ["/", "/library", "/progress", "/me"]) {
      rememberRoutePath(from);
      for (const to of ["/", "/library", "/progress", "/me"]) {
        expect(consumeRouteDirection(to)).toBe("root");
      }
    }
    rememberRoutePath("/");
    expect(consumeRouteDirection("/practice")).toBe("child");
    rememberRoutePath("/library");
    expect(consumeRouteDirection("/sets/example")).toBe("child");
    expect(adoptedParent("/sets/example")).toBe("/library");
    expect(adoptedParent("/sync")).toBe("/me");
  });
  it("pushes into a page the destination it was opened from does not own", () => {
    // A set reached from 今天 is filed under the Library, and reading that as a
    // branch switch left the first set of a session with no animation while
    // every one opened afterwards — from the Library, after a back — had one.
    rememberRoutePath("/");
    expect(consumeRouteDirection("/sets/example")).toBe("child");
    rememberRoutePath("/sets/example");
    expect(consumeRouteDirection("/me")).toBe("back");
    rememberRoutePath("/me");
    expect(consumeRouteDirection("/sync")).toBe("child");
  });
  it("names the destinations primary navigation points at", () => {
    for (const destination of ["/", "/library", "/progress", "/me"]) {
      expect(isRootRoute(destination)).toBe(true);
    }
    // A screen you arrive at from a destination is not one of them, however
    // shallow its URL looks.
    expect(isRootRoute("/practice")).toBe(false);
    expect(isRootRoute("/sync")).toBe(false);
    expect(isRootRoute("/sets/example")).toBe(false);
    expect(isRootRoute("/questions/generate")).toBe(false);
  });
});
