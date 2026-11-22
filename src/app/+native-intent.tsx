import { ROOM_CODE } from "@/core/domain/room";

const SHARE_PATH = /\/(?:app\/)?shared\/([\w-]+)/u;
const ROOM_PATH = /\/(?:app\/)?rooms\/([A-Za-z0-9]{6})(?:\/|$|\?)/u;

/**
 * Routes incoming universal links & custom-scheme URLs directly into native screens:
 * - https://lexiro.vercel.app/shared/<id> (or /app/shared/<id>) -> Shared Set modal
 * - https://lexiro.vercel.app/app/rooms/<code> -> Live Battle Room
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const shareMatch = path.match(SHARE_PATH);
  if (shareMatch?.[1]) {
    return `/sets/shared/${shareMatch[1]}`;
  }
  const roomMatch = path.match(ROOM_PATH);
  if (roomMatch?.[1]) {
    const code = roomMatch[1].toUpperCase();
    if (ROOM_CODE.test(code)) return `/room/${code}`;
  }
  return path;
}
