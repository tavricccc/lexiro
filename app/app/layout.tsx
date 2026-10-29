import { AdminBanner } from "@/components/admin/admin-banner";
import { AppShell } from "@/components/app-shell";
import { CloudGate } from "@/components/cloud-gate";
import { AppViews } from "@/components/app-views";
import { LibraryHydrator } from "@/components/library/library-hydrator";

/**
 * Every screen under /app sits in this shell. Moving between screens only
 * fetches the next screen's code, the first time it is visited.
 */
export function WorkspaceLayout() {
  return (
    <AppShell>
      <LibraryHydrator />
      <CloudGate>
        <AdminBanner />
        <AppViews />
      </CloudGate>
    </AppShell>
  );
}
