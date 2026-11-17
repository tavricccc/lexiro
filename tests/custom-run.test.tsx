import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PracticeItem } from "@/domain/practice";
import { newRound } from "@/domain/round";

const recorded = vi.hoisted(() => [] as { correct: boolean }[]);
vi.mock("@/data/auth", () => ({ currentAccount: () => ({ uid: "u" }) }));
vi.mock("@/data/learning", () => ({ recordAnswer: (answer: { correct: boolean }) => recorded.push(answer) }));

const typed: PracticeItem = {
  kind: "custom", questionId: "q", label: "拼字",
  steps: [{ mode: "input", prompt: "顏色", senseId: "s", wordId: "w", accepted: ["colour", "color"] }],
};

async function run(item: PracticeItem) {
  localStorage.setItem("lexiro:round:u", JSON.stringify(newRound([item, item], ["set"])));
  const { default: RunPage } = await import("@/features/practice/run-page");
  render(<RouterProvider router={createMemoryRouter([{ path: "/", Component: RunPage }, { path: "/app/practice", Component: () => null }])} />);
}

beforeEach(() => { recorded.length = 0; localStorage.clear(); });
afterEach(cleanup);

test("a typed answer marked right is recorded as right", async () => {
  await run(typed);
  fireEvent.change(screen.getByRole("textbox", { name: "你的答案" }), { target: { value: "colr" } });
  fireEvent.click(screen.getByRole("button", { name: /確認/ }));
  fireEvent.click(await screen.findByRole("button", { name: "我其實答對了" }));
  fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
  expect(recorded.map((answer) => answer.correct)).toEqual([true]);
});

test("a wrong typed answer is recorded as wrong on moving on", async () => {
  await run(typed);
  fireEvent.change(screen.getByRole("textbox", { name: "你的答案" }), { target: { value: "colr" } });
  fireEvent.click(screen.getByRole("button", { name: /確認/ }));
  fireEvent.click(await screen.findByRole("button", { name: /下一題/ }));
  expect(recorded.map((answer) => answer.correct)).toEqual([false]);
});

test("an order is answered by tapping its pieces in sequence", async () => {
  await run({ kind: "custom", questionId: "q", label: "語序", steps: [{ mode: "order", prompt: "排列", senseId: "s", wordId: "w", pieces: ["left", "She"], order: [1, 0] }] });
  fireEvent.click(screen.getByRole("button", { name: "She" }));
  fireEvent.click(screen.getByRole("button", { name: "left" }));
  fireEvent.click(screen.getByRole("button", { name: /確認/ }));
  expect(await screen.findByText("答對了")).toBeInTheDocument();
});
