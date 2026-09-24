import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUsageReport as UsageReport } from "@lexiro/ai-contract";

const { managed } = vi.hoisted(() => ({ managed: vi.fn() }));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const report: UsageReport = {
  entries: [],
  nextCursor: null,
  pendingUsage: 0,
  unavailableUsage: 0,
  unverifiedDebits: 0,
  models: [],
  users: [],
  kinds: [
    {
      kind: "vocabulary",
      tier: "lite",
      runs: 4,
      units: 40,
      input: 0,
      cached: 0,
      cacheWrite: 0,
      output: 0,
      credits: 40,
      costUsd: 0.005,
      points: 20,
    },
    {
      kind: "reading",
      tier: "pro",
      runs: 2,
      units: 2,
      input: 0,
      cached: 0,
      cacheWrite: 0,
      output: 0,
      credits: 240,
      costUsd: 0.03,
      points: 300,
    },
  ],
};
vi.mock("@/lib/managed-client", () => ({
  managedJson: managed,
  notifyManagedAccountChanged: () => undefined,
}));

const { AdminUsage } = await import("@/components/me/admin-usage");

function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
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

beforeEach(() => { managed.mockReset(); managed.mockResolvedValue(report); });
afterEach(cleanup);

describe("the administrator's per-kind cost report", () => {
  it("shows pending costs as unknown rather than free", async () => {
    managed.mockResolvedValue({ ...report, pendingUsage: 1, unverifiedDebits: 2, entries: [{
      id: "pending", uid: "u", email: "u@example.test", model: "gpt-6-luna", points: 0,
      input: null, cached: null, cacheWrite: null, output: null, credits: null, costUsd: null,
      created_at: 1, status: "complete", usageState: "pending", assessedPoints: null, debitVerified: 0,
    }] } satisfies UsageReport);
    show();
    expect(await screen.findByText("1 筆用量待核對")).toBeTruthy();
    expect(screen.getByText("2 筆歷史扣款無法核實")).toBeTruthy();
    const tab = screen.getByRole("tab", { name: "最近的生成" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    expect(screen.getByText("u@example.test · 成本待核對")).toBeTruthy();
    expect(screen.getByText("未知")).toBeTruthy();
    expect(screen.queryByText(/US\$/)).toBeNull();
    expect(screen.queryByText(/輸入 0/)).toBeNull();
  });

  it("prices one billable unit against what that unit is quoted at", async () => {
    await showKindReport();
    // 40 credits over 40 units is 1.00 each; vocabulary at lite is quoted at
    // half a point, so the quote is half what the work costs.
    expect(await screen.findByText("1.00 點")).toBeTruthy();
    expect(
      screen.getByText(/報價 0.5 點 · 4 次 · 40 單位 · 差 \+100%/),
    ).toBeTruthy();
    expect(screen.getByText(/總成本 US\$0\.005000/)).toBeTruthy();
  });

  it("names the work and the tier, and reads a quote that is too high", async () => {
    await showKindReport();
    // Reading at pro is quoted at 150 points a passage; 120 is what it cost.
    expect(await screen.findByText("閱讀測驗 · Pro")).toBeTruthy();
    expect(screen.getByText("120.00 點")).toBeTruthy();
    expect(
      screen.getByText(/報價 150.0 點 · 2 次 · 2 單位 · 差 −20%/),
    ).toBeTruthy();
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
