import { readFileSync } from "node:fs";
import { matchRoutes, type RouteObject } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "@/app/routes";
import { screenRoutes } from "@/components/app-views";
import { LEGACY_REDIRECTS, legacyDestination } from "@/lib/legacy-redirects";

const leaf = (pathname: string) => {
  const matches = matchRoutes(routes, pathname);
  const last = matches?.at(-1);
  return last && { route: last.route as RouteObject, params: last.params };
};

describe("client routes", () => {
  it("draws every app address and prefers literal segments over parameters", () => {
    for (const pathname of [
      "/app",
      "/app/",
      "/app/library",
      "/app/sets/new",
      "/app/sets/abc",
      "/app/sets/abc/words/w%201/edit",
      "/app/questions/reading/r1/edit",
      "/app/questions/q1/edit",
      "/app/rooms/new",
      "/app/rooms/ABCDEF",
      "/app/me/preferences",
      "/app/me/admin",
    ])
      expect(leaf(pathname)?.route.lazy, pathname).toBeTypeOf("function");
    expect(leaf("/app/sets/new")?.params).toEqual({});
    expect(leaf("/app/rooms/new")?.params).toEqual({});
    expect(leaf("/app/questions/reading/r1/edit")?.params).toEqual({
      readingId: "r1",
    });
    expect(leaf("/app/sets/abc/words/w%201/edit")?.params).toEqual({
      setId: "abc",
      wordKey: "w 1",
    });
    expect(leaf("/app/nothing/here")?.route.path).toBe("*");
  });

  it("loads each screen on its own, the first time it is visited", () => {
    const lazy = screenRoutes.filter((route) => route.lazy);
    expect(lazy.length).toBe(screenRoutes.length - 1);
  });

  it("keeps the pages outside the workspace", () => {
    for (const pathname of ["/agent/authorize", "/app-auth", "/~offline"])
      expect(leaf(pathname)?.route.path).toBe(pathname);
  });
});

describe("addresses from before /app", () => {
  it("follow the same table in the app as on the server", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(vercel.redirects).toEqual(LEGACY_REDIRECTS);
  });

  it("move under /app with the rest of the path", () => {
    expect(legacyDestination("/")).toBe("/app");
    expect(legacyDestination("/about")).toBe("/app");
    expect(legacyDestination("/settings")).toBe("/app/me");
    expect(legacyDestination("/questions/new")).toBe("/app/library");
    expect(legacyDestination("/questions/reading/new")).toBe("/app/library");
    expect(legacyDestination("/library")).toBe("/app/library");
    expect(legacyDestination("/sets/abc/add")).toBe("/app/sets/abc/add");
    expect(legacyDestination("/questions/q1/edit")).toBe(
      "/app/questions/q1/edit",
    );
    expect(legacyDestination("/librarything")).toBeNull();
    expect(legacyDestination("/app/library")).toBeNull();
  });
});

describe("deployment", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

  it("serves Firebase's sign-in handler from this origin", () => {
    for (const segment of ["auth", "firebase"])
      expect(vercel.rewrites).toContainEqual({
        source: `/__/${segment}/:path*`,
        destination: expect.stringMatching(
          new RegExp(
            `^https://[\\w-]+\\.firebaseapp\\.com/__/${segment}/:path\\*$`,
          ),
        ),
      });
  });

  it("answers every other address with the app, but not missing assets", () => {
    const fallback = vercel.rewrites.at(-1);
    expect(fallback.destination).toBe("/index.html");
    const source = new RegExp(`^${fallback.source}$`);
    expect(source.test("/app/sets/abc")).toBe(true);
    expect(source.test("/agent/authorize")).toBe(true);
    expect(source.test("/assets/index-abc.js")).toBe(false);
    expect(source.test("/__/auth/handler")).toBe(false);
  });
});
