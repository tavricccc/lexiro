import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { test, expect, vi } from "vitest";
globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} } as never;
window.scrollTo = () => {};
const content = (id: string) => ({ set: { id, name: id }, words: [1, 2, 3, 4].map((n) => ({ id: `${id}w${n}`, word: `w${n}`, starred: false, senses: [{ id: `${id}s${n}`, pos: "n.", meaning: `m${n}`, description: "", examples: [] }] })), questions: [] });
vi.mock("@/data/api", () => ({ api: vi.fn(async (path: string) => content(path.split("/").pop()!)) }));
vi.mock("@/data/queries", () => ({
  keys: { set: (id: string) => ["set", id] },
  useLibrary: () => ({ data: { sets: [{ id: "a", name: "A", wordCount: 4, questionCount: 0 }] } }),
  usePrefs: () => ({ data: { practiceSize: 20 } }),
  useRevisionWatch: () => {},
}));
vi.mock("@/data/prefs", () => ({ useThemeSync: () => {} }));
vi.mock("@/data/learning", () => ({ useLearning: () => ({ learning: { senses: {}, days: {} } }), recordAnswer: () => {}, useAnswerFlush: () => {}, usePendingAnswers: () => 0 }));
vi.mock("@/features/library/library-page", () => ({ orderedSets: (sets: unknown[]) => sets }));

// The setup page once re-rendered without end (useQueries gives a new array
// every render), which froze the tap on 開始練習 and 繼續.
test("start goes to the run page", async () => {
  const { WorkspaceShell } = await import("@/app/shell");
  const { default: SetupPage } = await import("@/features/practice/setup-page");
  const { default: RunPage } = await import("@/features/practice/run-page");
  const router = createMemoryRouter([{ path: "/app", Component: WorkspaceShell, children: [{ path: "practice", Component: SetupPage }, { path: "practice/run", Component: RunPage }] }], { initialEntries: ["/app/practice?set=a"] });
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  const start = await screen.findByRole("button", { name: /開始練習/ });
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  await waitFor(() => expect(router.state.location.pathname).toBe("/app/practice/run"));
  expect(await screen.findByText("不會，看答案")).toBeInTheDocument();
});
