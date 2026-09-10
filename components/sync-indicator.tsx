"use client";


import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

function statusCopy(status: string): string {
  if (status === "disabled") return t("settings.syncDisabled");
  if (status === "signed-out") return t("settings.syncSignedOut");
  if (status === "offline") return t("settings.syncOffline");
  if (status === "error") return t("settings.syncError");
  if (status === "synced") return t("settings.syncSynced");
  return t("settings.syncWorking");
}

export function SyncIndicator() {
  const configured = useCloudStore((store) => store.configured);
  const ready = useCloudStore((store) => store.ready);
  const status = useCloudStore((store) => store.status);
  const pending = useCloudStore((store) => store.pending);
  const sync = useCloudStore((store) => store.sync);
  const isWorking = ["connecting", "syncing", "preparing", "downloading", "reconciling", "uploading", "retrying", "verifying"].includes(status);
  const showPending = ready && pending;
  const Icon = !configured || status === "signed-out"
    ? Icons.syncOff
    : status === "error"
      ? Icons.error
      : isWorking
        ? Icons.loading
        : status === "synced" && !pending
          ? Icons.success
          : Icons.sync;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={statusCopy(status)}
          className="relative text-muted-foreground"
          disabled={!ready || !configured || isWorking}
          onClick={() => void sync()}
          size="icon-sm"
          variant="ghost"
        >
          <Icon className={isWorking ? "animate-spin" : undefined} />
          {showPending && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{statusCopy(status)}{showPending ? ` · ${t("settings.syncPending")}` : ""}</TooltipContent>
    </Tooltip>
  );
}

export function SyncRefreshButton() {
  const sync = useCloudStore((store) => store.sync);
  return (
    <Button aria-label={t("settings.syncNow")} onClick={() => void sync()} size="icon-sm" variant="ghost">
      <Icons.refresh />
    </Button>
  );
}
