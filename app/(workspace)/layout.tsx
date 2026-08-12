import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { LibraryHydrator } from "@/components/library/library-hydrator";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <LibraryHydrator />
      {children}
    </AppShell>
  );
}
