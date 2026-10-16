"use client";

import Link from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { RoomState } from "@/lib/room-client";
import { PlayerList } from "./room-lobby";
import { Review } from "./room-review";

export function Finished({ state }: { state: RoomState }) {
  const winner = state.players[0];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
        <Icons.levelUp
          aria-hidden
          className="t-celebrate mx-auto size-10 text-primary"
        />
        <h2 className="type-section mt-3">{t("rooms.final")}</h2>
        {winner && (
          <p className="t-result-in mt-1 text-lg font-semibold [animation-delay:var(--motion-control)]">
            {winner.name} · {t("rooms.points", { points: winner.score })}
          </p>
        )}
      </section>
      <section className="rounded-[var(--radius-card)] bg-card p-5">
        <PlayerList state={state} showScore />
      </section>
      {state.review && <Review review={state.review} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" variant="secondary">
          <Link href="/app/rooms">
            <Icons.back />
            {t("rooms.leave")}
          </Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/app/rooms/new">
            <Icons.create />
            {t("rooms.newRoom")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
