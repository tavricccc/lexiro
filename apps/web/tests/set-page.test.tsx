import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} } as never;
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;

let showMeanings = true;
const setContent = {
  set: { id: "s1", name: "Unit 1", folderId: null, hue: "mint", icon: "books", order: null, createdAt: "", updatedAt: "", wordCount: 1, questionCount: 0 },
  words: [
    {
      id: "w1",
      setId: "s1",
      word: "bank",
      starred: false,
      updatedAt: "",
      senses: [
        { id: "m1", pos: "n.", meaning: "銀行", description: "存錢的地方", examples: [], supplementary: false },
        { id: "m2", pos: "n.", meaning: "河岸", description: "", examples: [], supplementary: true },
      ],
    },
  ],
  questions: [],
};

vi.mock("@/data/api", () => ({
  api: vi.fn(async (path: string) => {
    if (path === "/library") return { folders: [], sets: [setContent.set], revision: 1 };
    if (path === "/prefs") return { theme: "system", practiceSize: 20, showMeanings };
    if (path === "/learning") return { goal: 20, days: {}, senses: {}, tasks: {} };
    return setContent;
  }),
  errorMessage: String,
  setRevisionListener: () => {},
}));
vi.mock("@/ui/offline-banner", () => ({ useOnline: () => true }));

beforeEach(() => {
  localStorage.clear();
  showMeanings = true;
});
afterEach(cleanup);

async function openSet() {
  const { default: SetPage } = await import("@/features/library/set-page");
  const router = createMemoryRouter([{ path: "/app/sets/:setId", Component: SetPage }], {
    initialEntries: ["/app/sets/s1"],
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test("separates supplementary senses and toggles selection across the whole row", async () => {
  await openSet();
  expect(await screen.findByText("n. 銀行")).toBeInTheDocument();
  expect(screen.getByText("補充")).toBeInTheDocument();
  expect(screen.getByText("n. 河岸")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "多選" }));
  const row = screen.getByRole("button", { name: /bank/ });
  expect(row).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(row);
  expect(row).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/已選/)).toHaveTextContent("已選 1 個");
});

test("hides meanings and notes when showMeanings preference is off", async () => {
  showMeanings = false;
  await openSet();
  expect(await screen.findByText("bank")).toBeInTheDocument();
  expect(screen.queryByText("n. 銀行")).not.toBeInTheDocument();
  expect(screen.queryByText("存錢的地方")).not.toBeInTheDocument();
});
