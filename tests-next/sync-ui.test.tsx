import { render, screen } from "@testing-library/react";
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
  afterEach(() => useCloudStore.setState(initialCloudState, true));

  it("renders the sync indicator without an unstable external-store snapshot loop", () => {
    expect(() => renderSyncIndicator()).not.toThrow();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the cloud gate without an unstable external-store snapshot loop", () => {
    expect(() => render(<CloudGate><div>workspace</div></CloudGate>)).not.toThrow();
  });

  it("keeps the active workspace mounted during a routine background sync", () => {
    useCloudStore.setState({ configured: true, ready: true, user: { uid: "test-user" } as never, status: "syncing" });
    render(<CloudGate><div>active practice</div></CloudGate>);
    expect(screen.getByText("active practice")).toBeInTheDocument();
  });

  it("keeps local work available when cloud sync fails", () => {
    useCloudStore.setState({ configured: true, ready: true, user: { uid: "test-user" } as never, status: "error", error: "offline" });
    render(<CloudGate><div>offline practice</div></CloudGate>);
    expect(screen.getByText("offline practice")).toBeInTheDocument();
  });
});
