"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { syncStatusLabel } from "@/lib/sync-status";
import { useCloudStore } from "@/stores/cloud-store";

/**
 * Who is signed in, at the top of 我的, the way a phone opens its settings.
 *
 * It is a row rather than a panel: the account is the first thing you check
 * and the first thing you change, so it leads to the account screen instead of
 * putting that screen's controls on this one.
 */
export function AccountRow() {
  const cloud = useCloudStore();
  const displayName = cloud.user?.displayName || t("me.guestName");
  const email = cloud.user?.email || t("settings.offlineReady");
  const initials = displayName.trim().slice(0, 1).toLocaleUpperCase() || "L";
  return (
    <section className="rule-card rule-list">
      <Link className="t-row flex items-center gap-4 py-4" href="/sync">
        <Avatar className="size-12 shrink-0 ring-1 ring-border">
          {cloud.user?.photoURL && (
            <AvatarImage alt="" src={cloud.user.photoURL} />
          )}
          <AvatarFallback className="text-base font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="type-section block truncate">{displayName}</span>
          <span className="type-row-detail mt-0.5 block truncate">{email}</span>
        </span>
        <span className="type-row-value shrink-0 text-sm">
          {syncStatusLabel(cloud.status)}
        </span>
        <Icons.open aria-hidden className="size-4 shrink-0 text-muted-foreground/70" />
      </Link>
    </section>
  );
}
