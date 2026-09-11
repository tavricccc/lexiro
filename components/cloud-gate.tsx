"use client";

import type { ReactNode } from "react";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import { useCloudStore } from "@/stores/cloud-store";

export function CloudGate({ children }: { children: ReactNode }) {
  const ready = useCloudStore((store) => store.ready);
  // `ready` is reserved for the initial cloud reconciliation. Once the
  // workspace is visible, routine background sync must not unmount the
  // current task and discard local interaction state.
  const waitingForAuthoritativeData = !ready;

  if (!waitingForAuthoritativeData) return children;
  return <WorkspaceSkeleton />;
}
