import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CloudGate } from "@/components/cloud-gate";
import { SyncIndicator } from "@/components/sync-indicator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCloudStore } from "@/stores/cloud-store";

const initialCloudState = useCloudStore.getState();

function renderSyncIndicator() {
  return render(
    <TooltipProvider>
      <SyncIndicator />
    </TooltipProvider>,
  );
}

describe("cloud sync UI", () => {
  afterEach(() => {
    cleanup();
    useCloudStore.setState(initialCloudState, true);
  });

  it("renders the sync indicator without an unstable external-store snapshot loop", () => {
    expect(() => renderSyncIndicator()).not.toThrow();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/sync");
  });

  it("renders the cloud gate without an unstable external-store snapshot loop", () => {
    expect(() => render(<CloudGate><div>workspace</div></CloudGate>)).not.toThrow();
  });

  it("keeps the active workspace mounted during a routine background sync", () => {
    useCloudStore.setState({ configured: true, ready: true, user: { uid: "test-user" } as never, status: "syncing" });
    render(<CloudGate><div>active practice</div></CloudGate>);
    expect(screen.getByText("active practice")).toBeInTheDocument();
  });

  it("says how much is waiting rather than only that something is", () => {
    useCloudStore.setState({ configured: true, ready: true, status: "synced", pending: 11 });
    renderSyncIndicator();
    expect(screen.getByRole("link").getAttribute("aria-label")).toContain("11");
  });

  it("keeps local work available when cloud sync fails", () => {
    useCloudStore.setState({ configured: true, ready: true, user: { uid: "test-user" } as never, status: "error", error: "offline" });
    render(<CloudGate><div>offline practice</div></CloudGate>);
    expect(screen.getByText("offline practice")).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in once, and remembers staying on this device", () => {
    window.localStorage.removeItem("lexiro:local-only");
    useCloudStore.setState({ configured: true, ready: true, user: null, status: "signed-out" });
    render(<CloudGate><div>workspace</div></CloudGate>);
    expect(screen.queryByText("workspace")).toBeNull();
    expect(screen.getByRole("button", { name: "使用 Google 登入" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "先不登入，只用這台裝置" }));
    expect(window.localStorage.getItem("lexiro:local-only")).toBe("1");
    cleanup();
    render(<CloudGate><div>workspace</div></CloudGate>);
    expect(screen.getByText("workspace")).toBeInTheDocument();
    window.localStorage.removeItem("lexiro:local-only");
  });

  it("never asks for an account when cloud sync is not set up", () => {
    useCloudStore.setState({ configured: false, ready: true, user: null, status: "disabled" });
    render(<CloudGate><div>workspace</div></CloudGate>);
    expect(screen.getByText("workspace")).toBeInTheDocument();
  });
});
