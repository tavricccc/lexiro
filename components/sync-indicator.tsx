"use client";

import Link from "next/link";

import type { SyncStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { syncStatusLabel } from "@/lib/sync-status";

function statusIcon(status: SyncStatus, pending: number) {
  if (status === "disabled" || status === "signed-out") return Icons.syncOff;
  if (status === "error") return Icons.error;
  if (status === "connecting" || status === "syncing") return Icons.loading;
  return status === "synced" && !pending ? Icons.success : Icons.sync;
}

export function SyncIndicator({ className }: { className?: string }) {
  const status = useCloudStore((store) => store.status);
  const pending = useCloudStore((store) => store.pending);
  const localOnly = status === "disabled" || status === "signed-out";
  const working = status === "connecting" || status === "syncing";
  const Icon = statusIcon(status, pending);
  // The count is the honest version of the old dot: "there are eleven things
  // still to send" is actionable in a way that "something is pending" is not.
  const label = localOnly
    ? t("settings.localOnly")
    : pending
      ? `${syncStatusLabel(status, pending)} · ${t("settings.syncPendingCount", { count: pending })}`
      : syncStatusLabel(status, pending);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          className={cn("relative text-muted-foreground", className)}
          size="icon-sm"
          variant="ghost"
        >
          <Link aria-label={label} href="/app/sync">
            <Icon className={working ? "animate-spin" : undefined} />
            {pending > 0 && !localOnly && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" />
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
