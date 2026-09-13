import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const report = {
  entries: [],
  nextOffset: null,
  models: [],
  users: [],
  kinds: [
    { kind: "vocabulary", tier: "lite", runs: 4, units: 40, input: 0, cached: 0, output: 0, credits: 40, points: 20 },
    { kind: "reading", tier: "pro", runs: 2, units: 2, input: 0, cached: 0, output: 0, credits: 240, points: 300 },
  ],
};
vi.mock("@/lib/managed-client", () => ({
  managedJson: () => Promise.resolve(report),
  notifyManagedAccountChanged: () => undefined,
}));

const { AdminUsage } = await import("@/components/me/admin-usage");

function show() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AdminUsage />
    </QueryClientProvider>,
  );
}

async function showKindReport() {
  show();
  const tab = await screen.findByRole("tab", {
    name: "每種工作的單位成本",
  });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

afterEach(cleanup);

describe("the administrator's per-kind cost report", () => {
  it("prices one billable unit against what that unit is quoted at", async () => {
    await showKindReport();
    // 40 credits over 40 units is 1.00 each; vocabulary at lite is quoted at
    // half a point, so the quote is half what the work costs.
    expect(await screen.findByText("1.00 點")).toBeTruthy();
    expect(screen.getByText(/報價 0.5 點 · 4 次 · 40 單位 · 差 \+100%/)).toBeTruthy();
  });

  it("names the work and the tier, and reads a quote that is too high", async () => {
    await showKindReport();
    // Reading at pro is quoted at 150 points a passage; 120 is what it cost.
    expect(await screen.findByText("閱讀測驗 · Pro")).toBeTruthy();
    expect(screen.getByText("120.00 點")).toBeTruthy();
    expect(screen.getByText(/報價 150.0 點 · 2 次 · 2 單位 · 差 −20%/)).toBeTruthy();
  });

  it("orders the widest gap first, because that is the one to act on", async () => {
    await showKindReport();
    const rows = await screen.findAllByText(/^(詞彙題|閱讀測驗) · /);
    expect(rows.map((row) => row.textContent)).toEqual([
      "詞彙題 · Lite",
      "閱讀測驗 · Pro",
    ]);
  });
});
