import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { managed } = vi.hoisted(() => ({ managed: vi.fn() }));
vi.mock("@/lib/managed-client", () => ({ managedJson: managed }));
const { AdminAccountList } = await import("@/components/me/admin-accounts");
const { AdminUsage } = await import("@/components/me/admin-usage");
const { AdminPanel } = await import("@/components/me/admin-panel");
afterEach(cleanup);

describe("admin cursor navigation", () => {
  it("loads the admin menu without offset parameters and identifies incomplete totals", async () => {
    managed.mockReset();
    managed.mockResolvedValue({ accounts: [], nextCursor: null, models: [],
      pendingUsage: 1, unavailableUsage: 0, unverifiedDebits: 0, freeTrial: false });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminPanel />
    </QueryClientProvider>);
    expect(await screen.findByText("部分成本待確認，合計只含已知用量。")).toBeTruthy();
    expect(managed).toHaveBeenCalledWith("/admin/accounts");
    expect(managed).toHaveBeenCalledWith("/admin/usage");
  });

  it.each([
    { Component: AdminAccountList, path: "/admin/accounts", usage: false },
    { Component: AdminUsage, path: "/admin/usage", usage: true },
  ])("moves forward and back through $path", async ({ Component, path, usage }) => {
    managed.mockReset();
    managed.mockImplementation(async (url: string) => {
      const next = url.includes("?cursor=");
      const email = next ? "second@example.test" : "first@example.test";
      return {
        accounts: [{ uid: email, email, points: 10, monthly: 0, renews_at: 0, note: null }],
        entries: [{ id: email, uid: email, email, model: "gpt-5.6-luna", points: 1,
          input: 1, cached: 0, cacheWrite: 0, output: 1, credits: 1, created_at: 1,
          status: "complete", usageState: "reported", assessedPoints: 1, debitVerified: 1 }],
        nextCursor: next ? null : "opaque-next",
        models: [], users: [], kinds: [], pendingUsage: 0, unavailableUsage: 0, unverifiedDebits: 0,
      };
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Component />
    </QueryClientProvider>);
    if (usage) {
      const tab = await screen.findByRole("tab", { name: "最近的生成" });
      fireEvent.mouseDown(tab);
      fireEvent.click(tab);
    }
    expect(await screen.findByText("first@example.test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一頁" }));
    expect(await screen.findByText("second@example.test")).toBeTruthy();
    expect(managed).toHaveBeenCalledWith(`${path}?cursor=opaque-next`);
    fireEvent.click(screen.getByRole("button", { name: "上一頁" }));
    expect(await screen.findByText("first@example.test")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "上一頁" })).toBeNull();
  });
});
