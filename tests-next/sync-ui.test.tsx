import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CloudGate } from "@/components/cloud-gate";
import { SyncIndicator } from "@/components/sync-indicator";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderSyncIndicator() {
  return render(
    <TooltipProvider>
      <SyncIndicator />
    </TooltipProvider>,
  );
}

describe("cloud sync UI", () => {
  it("renders the sync indicator without an unstable external-store snapshot loop", () => {
    expect(() => renderSyncIndicator()).not.toThrow();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the cloud gate without an unstable external-store snapshot loop", () => {
    expect(() => render(<CloudGate><div>workspace</div></CloudGate>)).not.toThrow();
  });
});
