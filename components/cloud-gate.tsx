"use client";

import type { ReactNode } from "react";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import { useCloudStore } from "@/stores/cloud-store";
import { ErrorState } from "@/components/ui/page-state";

/**
 * Holds the workspace back until the *local* Library is loaded, and not one
 * moment longer.
 *
 * This used to wait for the first cloud reconciliation, so opening the app
 * meant staring at a skeleton through a round trip to Firestore — and through
 * every retry when that round trip went badly. The data on this device is
 * already the data the user was working with; sync catches it up underneath.
 */
export function CloudGate({ children }: { children: ReactNode }) {
  const ready = useCloudStore((store) => store.ready);
  const error = useCloudStore((store) => store.error);
  if (ready) return children;
  if (error)
    return (
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    );
  return <WorkspaceSkeleton />;
}
