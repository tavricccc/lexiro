"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { syncStatusLabel } from "@/lib/sync-status";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

/**
 * The account screen: what the cloud knows, then the two things you can do
 * about it. Each action is its own row, because 立即同步 and 登出 are not a
 * decision and its escape — they are two separate errands that happen to live
 * on the same screen.
 */
export function AccountSection() {
  const cloud = useCloudStore();
  const library = useLibraryStore((store) => store.state);
  const stats = useLearningStore((store) => store.stats);
  const [confirmSignIn, setConfirmSignIn] = useState(false);
  const isWorking = cloud.status === "syncing" || cloud.status === "connecting";
  const displayName = cloud.user?.displayName || t("me.guestName");
  const email = cloud.user?.email || t("settings.offlineReady");

  const signIn = async () => {
    try {
      await cloud.signIn();
      toast.success(t("me.signedIn"));
    } catch (reason) {
      toast.error(t("me.actionFailed", { message: errorMessage(reason) }));
    }
  };

  const sync = async () => {
    try {
      await cloud.sync();
      if (useCloudStore.getState().status === "synced") {
        toast.success(t("me.syncComplete"));
      }
    } catch (reason) {
      toast.error(t("me.actionFailed", { message: errorMessage(reason) }));
    }
  };

  const signOut = async () => {
    try {
      await cloud.signOut();
      toast.success(t("me.signedOut"));
    } catch (reason) {
      toast.error(t("me.actionFailed", { message: errorMessage(reason) }));
    }
  };

  const requestSignIn = () => {
    const hasGuestData =
      library.sets.length > 0 ||
      stats.totalMemoryReviews > 0 ||
      stats.totalQuestionReviews > 0;
    if (hasGuestData) setConfirmSignIn(true);
    else void signIn();
  };

  return (
    <div className="space-y-7">
      <ListSection
        footer={
          cloud.configured
            ? t("me.accountDescription")
            : t("settings.notConfigured")
        }
        header={t("settings.account")}
      >
        <ListRow label={displayName} value={email} />
        <ListRow
          label={t("sync.statusLabel")}
          value={syncStatusLabel(cloud.status)}
        />
        {cloud.pending > 0 && (
          <ListRow
            label={t("sync.pendingLabel")}
            value={t("settings.syncPendingCount", { count: cloud.pending })}
          />
        )}
        {cloud.error && <ListRow label={cloud.error} tone="destructive" />}
      </ListSection>

      <ListSection>
        {cloud.configured && !cloud.user && (
          <ListActionRow
            disabled={!cloud.ready || isWorking}
            onClick={requestSignIn}
          >
            {t("settings.signIn")}
          </ListActionRow>
        )}
        {cloud.user && (
          <>
            <ListActionRow disabled={isWorking} onClick={() => void sync()}>
              {t("settings.syncNow")}
            </ListActionRow>
            <ListActionRow onClick={() => void signOut()} tone="destructive">
              {t("settings.signOut")}
            </ListActionRow>
          </>
        )}
      </ListSection>

      <ConfirmDialog
        confirmLabel={t("settings.continueSignIn")}
        description={t("settings.guestDataWarning")}
        onConfirm={async () => {
          setConfirmSignIn(false);
          await signIn();
        }}
        onOpenChange={setConfirmSignIn}
        open={confirmSignIn}
        title={t("settings.signIn")}
        tone="default"
      />
    </div>
  );
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
