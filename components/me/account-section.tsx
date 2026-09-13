"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoogleMark } from "@/components/ui/google-mark";
import { Icons } from "@/components/ui/icons";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { syncStatusLabel } from "@/lib/sync-status";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

/**
 * The account screen: who you are, what the cloud knows, and the two things you
 * can do about it. Each action is its own row, because 立即同步 and 登出 are not
 * a decision and its escape — they are two separate errands that happen to live
 * on the same screen.
 *
 * The screen opens on a face rather than a line of text. Signing in is the one
 * place the product hands the reader to somebody else, so the control carries
 * Google's mark: a row that only said 登入 gave no clue about where the tap was
 * about to send them.
 */
export function AccountSection() {
  const cloud = useCloudStore();
  const library = useLibraryStore((store) => store.state);
  const stats = useLearningStore((store) => store.stats);
  const [confirmSignIn, setConfirmSignIn] = useState(false);
  const [working, setWorking] = useState<"in" | "sync" | "out" | null>(null);
  const isWorking =
    working !== null ||
    cloud.status === "syncing" ||
    cloud.status === "connecting";
  const displayName = cloud.user?.displayName || t("me.guestName");
  const email = cloud.user?.email || t("settings.offlineReady");
  const initials = displayName.trim().slice(0, 1).toLocaleUpperCase() || "L";

  const run = async (
    step: "in" | "sync" | "out",
    action: () => Promise<void>,
    done: () => string | null,
  ) => {
    setWorking(step);
    try {
      await action();
      const message = done();
      if (message) toast.success(message);
    } catch (reason) {
      toast.error(t("me.actionFailed", { message: errorMessage(reason) }));
    } finally {
      setWorking(null);
    }
  };

  const signIn = () =>
    run("in", () => cloud.signIn(), () => t("me.signedIn"));
  const sync = () =>
    run("sync", () => cloud.sync({ reconcileAccount: true }), () =>
      useCloudStore.getState().status === "synced" ? t("me.syncComplete") : null,
    );
  const signOut = () =>
    run("out", () => cloud.signOut(), () => t("me.signedOut"));

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
      <section className="rule-card flex items-center gap-4 py-5">
        <Avatar className="size-14 shrink-0 ring-1 ring-border">
          {cloud.user?.photoURL && (
            <AvatarImage alt="" src={cloud.user.photoURL} />
          )}
          <AvatarFallback className="text-lg font-semibold">
            {cloud.user ? initials : <Icons.account className="size-6" />}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="type-section block truncate">{displayName}</span>
          <span className="type-row-detail mt-0.5 block truncate">{email}</span>
        </span>
      </section>

      <ListSection
        footer={
          cloud.configured
            ? t("me.accountDescription")
            : t("settings.notConfigured")
        }
      >
        <ListRow
          icon={cloud.error ? Icons.syncOff : Icons.sync}
          label={t("sync.statusLabel")}
          tone={cloud.error ? "destructive" : "default"}
          value={syncStatusLabel(cloud.status)}
        />
        {cloud.pending > 0 && (
          <ListRow
            icon={Icons.backup}
            label={t("sync.pendingLabel")}
            value={t("settings.syncPendingCount", { count: cloud.pending })}
          />
        )}
        {cloud.error && (
          <ListRow icon={Icons.error} label={cloud.error} tone="destructive" />
        )}
      </ListSection>

      <ListSection>
        {cloud.configured && !cloud.user && (
          <ListActionRow
            busy={working === "in"}
            disabled={!cloud.ready || isWorking}
            onClick={requestSignIn}
          >
            {working !== "in" && <GoogleMark className="size-[1.125rem]" />}
            {t("settings.signIn")}
          </ListActionRow>
        )}
        {cloud.user && (
          <>
            <ListActionRow
              busy={working === "sync"}
              disabled={isWorking}
              onClick={() => void sync()}
            >
              {working !== "sync" && (
                <Icons.sync aria-hidden className="size-[1.125rem]" />
              )}
              {t("settings.syncNow")}
            </ListActionRow>
            <ListActionRow
              busy={working === "out"}
              disabled={isWorking}
              onClick={() => void signOut()}
              tone="destructive"
            >
              {working !== "out" && (
                <Icons.signOut aria-hidden className="size-[1.125rem]" />
              )}
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
