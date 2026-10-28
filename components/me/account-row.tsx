import Link from "@/components/ui/app-link";

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
    // The account on the green poster, as in the app; the photo is cut to the bubble.
    <Link
      className="grid gap-4 rounded-[var(--radius-stage)] bg-[#7cc49c] p-[1.375rem] text-[#13201a] transition-[filter] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href="/app/sync"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="grid h-[4.5rem] w-[6.75rem] place-items-center overflow-hidden rounded-full bg-[#13201a]">
          {cloud.user?.photoURL ? (
            <img
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              src={cloud.user.photoURL}
            />
          ) : (
            <span className="text-[2.125rem] font-extrabold text-[#7cc49c]">
              {initials}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold">
          {syncStatusLabel(cloud.status, cloud.pending)}
          <Icons.open aria-hidden className="size-4" />
        </span>
      </span>
      <span className="grid gap-0.5">
        <span className="truncate text-[1.875rem] font-extrabold leading-tight tracking-[-0.03em]">
          {displayName}
        </span>
        <span className="truncate text-base">{email}</span>
      </span>
    </Link>
  );
}
