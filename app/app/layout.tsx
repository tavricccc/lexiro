import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CloudGate } from "@/components/cloud-gate";
import { AppViews } from "@/components/app-views";
import { LibraryHydrator } from "@/components/library/library-hydrator";

/**
 * Every screen under /app is drawn by the client view host, so the catch-all
 * page beneath this layout renders nothing and moving between screens never
 * asks the server for one.
 */
export default function WorkspaceLayout() {
  return (
    <AppShell>
      <LibraryHydrator />
      <CloudGate>
        <Suspense>
          <AppViews />
        </Suspense>
      </CloudGate>
    </AppShell>
  );
}
