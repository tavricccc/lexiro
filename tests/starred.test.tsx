import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} } as never;
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;
const word = (set: string, text: string, starred: boolean) => ({ id: `${set}-${text}`, setId: set, word: text, starred, updatedAt: "", senses: [{ id: `${set}-${text}-s`, pos: "n.", meaning: `${text} 的意思`, examples: [] }] });
const summary = (id: string, name: string) => ({ id, name, folderId: null, hue: "mint", icon: "books", order: null, createdAt: "", updatedAt: "", wordCount: 3, questionCount: 0 });
const sets: Record<string, unknown> = {
  a: { set: summary("a", "甲"), words: [word("a", "apple", false), word("a", "banana", true), word("a", "cherry", false)], questions: [] },
  b: { set: summary("b", "乙"), words: [word("b", "dog", true), word("b", "egg", false), word("b", "fig", false)], questions: [] },
};
vi.mock("@/data/api", () => ({ api: vi.fn(async (path: string) => (path === "/library" ? { folders: [], sets: [summary("a", "甲"), summary("b", "乙")], revision: 1 } : sets[path.split("/").pop()!])), errorMessage: String }));
vi.mock("@/ui/offline-banner", () => ({ useOnline: () => true }));

async function open(path: string, route: string, load: () => Promise<{ default: () => React.ReactNode }>) {
  const { default: Page } = await load();
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={createMemoryRouter([{ path: route, Component: Page }], { initialEntries: [path] })} /></QueryClientProvider>);
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

test("the starred page lists every set's starred words and practises them", async () => {
  await open("/app/starred", "/app/starred", () => import("@/features/library/starred-page"));
  expect(await screen.findByText("banana")).toBeInTheDocument();
  expect(await screen.findByText("dog")).toBeInTheDocument();
  expect(screen.queryByText("apple")).not.toBeInTheDocument();
  const practice = new URL(screen.getByRole("link", { name: /練習這 2 個字/ }).getAttribute("href")!, "http://x");
  expect(practice.pathname).toBe("/app/practice");
  expect(practice.searchParams.getAll("set").sort()).toEqual(["a", "b"]);
  expect(practice.searchParams.get("focus")).toBe("starred");
});

test("a set lists its starred words first once asked, and remembers it", async () => {
  await open("/app/sets/a", "/app/sets/:setId", () => import("@/features/library/set-page"));
  const list = await screen.findByRole("region", { name: "單字" });
  const order = () => within(list).getAllByRole("link").map((link) => link.textContent?.split(" ")[0]);
  expect(order()[0]).toMatch(/^apple/);
  fireEvent.click(screen.getByRole("button", { name: "標星置頂" }));
  expect(order()[0]).toMatch(/^banana/);
  expect(localStorage.getItem("lexiro:starredFirst")).toBe("1");
});
