import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} } as never;

const data = {
  set: { id: "s1", name: "Unit 1", folderId: null, hue: "mint", icon: "books", order: null, createdAt: "", updatedAt: "", wordCount: 2, questionCount: 0 },
  words: [
    {
      id: "w1",
      setId: "s1",
      word: "apple",
      starred: false,
      updatedAt: "",
      senses: [
        { id: "s1a", pos: "n.", meaning: "蘋果", description: "常見水果", examples: [], supplementary: false },
        { id: "s1b", pos: "n.", meaning: "珍愛之物", description: "", examples: [], supplementary: true },
      ],
    },
    {
      id: "w2",
      setId: "s1",
      word: "banana",
      starred: true,
      updatedAt: "",
      senses: [{ id: "s2a", pos: "n.", meaning: "香蕉", description: "", examples: [], supplementary: false }],
    },
  ],
  questions: [],
};

vi.mock("@/data/api", () => ({
  api: vi.fn(async () => data),
  errorMessage: String,
  setRevisionListener: () => {},
}));

afterEach(cleanup);

async function openCards() {
  const { default: CardsPage } = await import("@/features/library/cards-page");
  const router = createMemoryRouter([{ path: "/app/sets/:setId/cards", Component: CardsPage }], {
    initialEntries: ["/app/sets/s1/cards"],
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test("steps through cards, filters starred words, and groups supplementary senses", async () => {
  await openCards();
  expect(await screen.findByText("1 / 2")).toBeInTheDocument();
  expect(screen.getAllByText("apple").length).toBeGreaterThan(0);
  expect(screen.getByText("補充")).toBeInTheDocument();
  expect(screen.getByText("珍愛之物")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "下一張" }));
  expect(await screen.findByText("2 / 2")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /只看標星/ }));
  expect(await screen.findByText("1 / 1")).toBeInTheDocument();
  expect(screen.getAllByText("banana").length).toBeGreaterThan(0);
});
