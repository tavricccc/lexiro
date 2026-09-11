"use client";

import type { SyncStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

function statusCopy(status: SyncStatus): string {
  if (status === "disabled") return t("settings.syncDisabled");
  if (status === "signed-out") return t("settings.syncSignedOut");
  if (status === "offline") return t("settings.syncOffline");
  if (status === "error") return t("settings.syncError");
  if (status === "synced") return t("settings.syncSynced");
  return t("settings.syncWorking");
}

function statusIcon(status: SyncStatus, pending: number) {
  if (status === "disabled" || status === "signed-out") return Icons.syncOff;
  if (status === "error") return Icons.error;
  if (status === "connecting" || status === "syncing") return Icons.loading;
  return status === "synced" && !pending ? Icons.success : Icons.sync;
}

export function SyncIndicator() {
  const configured = useCloudStore((store) => store.configured);
  const status = useCloudStore((store) => store.status);
  const pending = useCloudStore((store) => store.pending);
  const sync = useCloudStore((store) => store.sync);
  const working = status === "connecting" || status === "syncing";
  const Icon = statusIcon(status, pending);
  // The count is the honest version of the old dot: "there are eleven things
  // still to send" is actionable in a way that "something is pending" is not.
  const label = pending
    ? `${statusCopy(status)} · ${t("settings.syncPendingCount", { count: pending })}`
    : statusCopy(status);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="relative text-muted-foreground"
          disabled={!configured || working}
          onClick={() => void sync()}
          size="icon-sm"
          variant="ghost"
        >
          <Icon className={working ? "animate-spin" : undefined} />
          {pending > 0 && (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function SyncRefreshButton() {
  const sync = useCloudStore((store) => store.sync);
  return (
    <Button
      aria-label={t("settings.syncNow")}
      onClick={() => void sync()}
      size="icon-sm"
      variant="ghost"
    >
      <Icons.refresh />
    </Button>
  );
}
