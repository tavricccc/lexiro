"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloudStore } from "@/stores/cloud-store";

export function CloudGate({ children }: { children: ReactNode }) {
  const ready = useCloudStore((store) => store.ready);
  // `ready` is reserved for the initial cloud reconciliation. Once the
  // workspace is visible, routine background sync must not unmount the
  // current task and discard local interaction state.
  const waitingForAuthoritativeData = !ready;

  if (!waitingForAuthoritativeData) return children;
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-3xl space-y-4 py-8">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  );
}
