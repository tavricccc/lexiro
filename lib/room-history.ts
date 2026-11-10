import { getStorageNamespace } from "@/src/lib/persist";
import type { RoomState } from "@/lib/room-client";

export interface RecentRoom {
  code: string;
  title: string;
  rank: number;
  players: number;
  finishedAt: string;
}
const key = () => `${getStorageNamespace()}:lexiro:room-history:v1`;
export function readRecentRooms(): RecentRoom[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key()) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (r): r is RecentRoom =>
              r &&
              typeof r.code === "string" &&
              typeof r.title === "string" &&
              typeof r.finishedAt === "string" &&
              Number.isInteger(r.rank) &&
              Number.isInteger(r.players),
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function rememberFinishedRoom(room: RoomState): void {
  if (room.phase !== "ended") return;
  const recent = readRecentRooms();
  if (recent.some((entry) => entry.code === room.code)) return;
  const rank = room.players.findIndex((player) => player.uid === room.you) + 1;
  if (!rank) return;
  try {
    localStorage.setItem(
      key(),
      JSON.stringify(
        [
          {
            code: room.code,
            title: room.title,
            rank,
            players: room.players.length,
            finishedAt: new Date().toISOString(),
          },
          ...recent,
        ].slice(0, 10),
      ),
    );
  } catch {
    /* A full device does not block the live game. */
  }
}
