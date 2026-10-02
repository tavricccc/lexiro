import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AccountSection } from "@/components/me/account-section";
import { AccountRow } from "@/components/me/account-row";
import { SyncIndicator } from "@/components/sync-indicator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCloudStore } from "@/stores/cloud-store";
import { useAppUpdateStore } from "@/stores/app-update-store";
import { AppUpdateSection } from "@/components/me/app-update-section";

const success = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));
const original = useCloudStore.getState();
const originalUpdate = useAppUpdateStore.getState();
beforeEach(() => {
  success.mockClear();
  useCloudStore.setState({
    ...original,
    configured: true,
    ready: true,
    user: { uid: "u", displayName: "Learner", email: "u@example.test" } as User,
    status: "synced",
    pending: 3,
    sync: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  });
});
afterEach(() => {
  cleanup();
  useCloudStore.setState(original);
  useAppUpdateStore.setState(originalUpdate);
});

describe("app connection feedback", () => {
  it("uses waiting feedback consistently while newer changes remain queued", async () => {
    render(
      <TooltipProvider>
        <AccountSection />
        <AccountRow />
        <SyncIndicator />
      </TooltipProvider>,
    );
    expect(screen.getAllByText("等待同步")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "等待同步 · 3 項待同步" }),
    ).toBeVisible();
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "立即同步" }));
    await waitFor(() =>
      expect(useCloudStore.getState().sync).toHaveBeenCalledOnce(),
    );
    expect(success).not.toHaveBeenCalled();
  });
  it("lets the user sign out while a background sync is running", async () => {
    useCloudStore.setState({ status: "syncing" });
    render(<AccountSection />);
    const logout = screen.getByRole("button", { name: "登出" });
    expect(logout).toBeEnabled();
    fireEvent.click(logout);
    await waitFor(() =>
      expect(useCloudStore.getState().signOut).toHaveBeenCalledOnce(),
    );
  });
  it("lets logout supersede manual sync without the old completion clearing its busy state", async () => {
    let finishSync!: () => void;
    let finishLogout!: () => void;
    useCloudStore.setState({
      pending: 0,
      sync: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishSync = resolve;
          }),
      ),
      signOut: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishLogout = resolve;
          }),
      ),
    });
    render(<AccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "立即同步" }));
    const logout = screen.getByRole("button", { name: "登出" });
    expect(logout).toBeEnabled();
    fireEvent.click(logout);
    finishSync();
    await waitFor(() => expect(logout).toBeDisabled());
    expect(success).not.toHaveBeenCalled();
    finishLogout();
    await waitFor(() => expect(logout).toBeEnabled());
  });
  it("shows the update's storage stage and disables another activation", () => {
    useAppUpdateStore.setState({
      available: true,
      phase: "saving",
      online: true,
      check: vi.fn(async () => undefined),
      apply: vi.fn(async () => undefined),
    });
    render(<AppUpdateSection />);
    expect(screen.getByText("新版已準備好")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "等待本機儲存…" }),
    ).toBeDisabled();
  });
});
