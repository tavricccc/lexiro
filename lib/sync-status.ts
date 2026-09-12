import { t } from "@/lib/i18n";

/** One word for what the cloud is doing, shared by every place that says it. */
export function syncStatusLabel(status: string): string {
  if (status === "disabled") return t("settings.syncDisabled");
  if (status === "signed-out") return t("settings.syncSignedOut");
  if (status === "synced") return t("settings.syncSynced");
  if (status === "offline") return t("settings.syncOffline");
  if (status === "error") return t("settings.syncError");
  if (status === "connecting") return t("settings.syncConnecting");
  return t("settings.syncWorking");
}
