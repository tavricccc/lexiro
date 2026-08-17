import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { CloudGate } from "@/components/cloud-gate";
import { LibraryHydrator } from "@/components/library/library-hydrator";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <LibraryHydrator />
      <CloudGate>{children}</CloudGate>
    </AppShell>
  );
}
