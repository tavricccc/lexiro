"use client";

import { useEffect, useState } from "react";

import Link from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { fetchActiveRoom } from "@/lib/room-client";
import { useCloudStore } from "@/stores/cloud-store";

/**
 * A room this person is hosting on another device. Opening it here takes the
 * seat over; the room closes the older device's connection.
 */
export function ActiveRoomCard({ className }: { className?: string }) {
  const uid = useCloudStore((store) => store.user?.uid ?? null);
  const [room, setRoom] = useState<{ code: string; title: string } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      fetchActiveRoom()
        .then(({ room }) => !cancelled && setRoom(room))
        .catch(() => {});
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", check);
    };
  }, [uid]);

  if (!uid || !room) return null;
  return (
    <section className={`active-room-card ${className ?? ""}`}>
      <Icons.rooms aria-hidden className="size-5 shrink-0 text-[var(--success)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {t("rooms.activeRoom", { title: room.title })}
        </p>
        <p className="text-sm text-muted-foreground">{t("rooms.activeRoomHint")}</p>
      </div>
      <Button asChild size="sm">
        <Link href={`/app/rooms/${room.code}`}>{t("rooms.resumeRoom")}</Link>
      </Button>
    </section>
  );
}
