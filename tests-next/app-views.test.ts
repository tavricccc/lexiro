import { describe, expect, it } from "vitest";

import { matchScreen } from "@/components/app-views";
import { canNavigateInPlace, isInAppHref, navigate } from "@/lib/app-navigation";

describe("client view host", () => {
  it("draws every app address and prefers literal segments over parameters", () => {
    for (const pathname of [
      "/app",
      "/app/",
      "/app/library",
      "/app/sets/new",
      "/app/sets/new/organize",
      "/app/sets/abc",
      "/app/sets/abc/words/w%201/edit",
      "/app/questions/reading/r1/edit",
      "/app/questions/q1/edit",
      "/app/rooms/new",
      "/app/rooms/ABCDEF",
      "/app/me/admin/accounts/u1",
    ])
      expect(matchScreen(pathname), pathname).not.toBeNull();
    expect(matchScreen("/app/sets/new")?.params).toEqual([]);
    expect(matchScreen("/app/rooms/new")?.params).toEqual([]);
    expect(matchScreen("/app/sets/abc/words/w%201/edit")?.params).toEqual(["abc", "w 1"]);
    expect(matchScreen("/app/nothing/here")).toBeNull();
  });

  it("only moves in place inside the app while the view host is on screen", () => {
    expect(isInAppHref("/app/library?q=a")).toBe(true);
    expect(isInAppHref("/apple")).toBe(false);
    expect(isInAppHref("/agent/authorize")).toBe(false);
    expect(canNavigateInPlace("/app/library")).toBe(false);
    expect(navigate("/app/library")).toBe(false);
  });
});
