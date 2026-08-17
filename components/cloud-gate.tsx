"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function CloudGate({ children }: { children: ReactNode }) {
  const { configured, ready, user, status } = useCloudStore((store) => ({
    configured: store.configured,
    ready: store.ready,
    user: store.user,
    status: store.status,
  }));
  const waitingForAuthoritativeData = !ready || (configured && Boolean(user) && ["connecting", "syncing"].includes(status));

  if (configured && user && status === "error") {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
        <AlertCircle className="size-5 text-destructive" />
        <p className="text-sm text-muted-foreground">{t("settings.syncError")}</p>
        <Button onClick={() => void useCloudStore.getState().sync()} size="sm" variant="secondary">
          <RefreshCw className="size-4" />
          {t("settings.syncNow")}
        </Button>
      </div>
    );
  }

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
