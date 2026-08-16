"use client";

import { BarChart3, Cloud, LogIn, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { MeSection } from "@/components/me/me-section";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

export function AccountSection() {
  const cloud = useCloudStore();
  const library = useLibraryStore((store) => store.state);
  const stats = useLearningStore((store) => store.stats);
  const [confirmSignIn, setConfirmSignIn] = useState(false);
  const isWorking = cloud.status === "syncing" || cloud.status === "connecting";
  const displayName = cloud.user?.displayName || t("me.guestName");
  const email = cloud.user?.email || t("settings.offlineReady");
  const initials = displayName.trim().slice(0, 1).toLocaleUpperCase() || "L";

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
    <>
      <div className="mb-8 flex flex-col gap-5 rounded-xl bg-muted p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="lg" className="size-12 ring-1 ring-border">
            {cloud.user?.photoURL && (
              <AvatarImage src={cloud.user.photoURL} alt="" />
            )}
            <AvatarFallback className="text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">
              {displayName}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={cloud.status === "error" ? "destructive" : "secondary"}>
            {syncStatusLabel(cloud.status)}
          </Badge>
          <Button asChild variant="ghost" size="sm">
            <Link href="/progress">
              <BarChart3 className="size-4" />
              {t("me.viewProgress")}
            </Link>
          </Button>
        </div>
      </div>

      <MeSection
        icon={Cloud}
        title={t("settings.account")}
        description={t("me.accountDescription")}
      >
        <div className="flex flex-wrap gap-2">
          {cloud.configured && !cloud.user && (
            <Button onClick={requestSignIn} disabled={!cloud.ready || isWorking}>
              <LogIn className="size-4" />
              {t("settings.signIn")}
            </Button>
          )}
          {cloud.user && (
            <>
              <Button onClick={() => void sync()} disabled={isWorking}>
                <RefreshCw className={isWorking ? "size-4 animate-spin" : "size-4"} />
                {t("settings.syncNow")}
              </Button>
              <Button variant="secondary" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                {t("settings.signOut")}
              </Button>
            </>
          )}
        </div>
        {!cloud.configured && (
          <p className="text-sm leading-6 text-muted-foreground">
            {t("settings.notConfigured")}
          </p>
        )}
        {cloud.pending && (
          <p className="mt-3 text-sm text-warning">{t("settings.syncPending")}</p>
        )}
        {cloud.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {cloud.error}
          </p>
        )}
      </MeSection>

      <ConfirmDialog
        open={confirmSignIn}
        onOpenChange={setConfirmSignIn}
        title={t("settings.signIn")}
        description={t("settings.guestDataWarning")}
        confirmLabel={t("settings.continueSignIn")}
        onConfirm={async () => {
          setConfirmSignIn(false);
          await signIn();
        }}
      />
    </>
  );
}

function syncStatusLabel(status: string) {
  if (status === "disabled") return t("settings.syncDisabled");
  if (status === "signed-out") return t("settings.syncSignedOut");
  if (status === "synced") return t("settings.syncSynced");
  if (status === "offline") return t("settings.syncOffline");
  if (status === "error") return t("settings.syncError");
  if (status === "connecting") return t("settings.syncConnecting");
  return t("settings.syncWorking");
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
