import { HttpError, readBody } from "../http";
import {
  createRoomInput,
  newRoomCode,
  ROOM_CODE,
  ticketInput,
} from "./protocol";

export interface RoomNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(request: Request | string, init?: RequestInit): Promise<Response>;
  };
}

const roomStub = (rooms: RoomNamespace, code: string) =>
  rooms.get(rooms.idFromName(`room:${code}`));

async function relay(response: Response) {
  if (response.ok) return response;
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string };
  } | null;
  throw new HttpError(
    response.status,
    body?.error?.code ?? "room_unavailable",
  );
}

/** Creating a room and asking to join both need a signed-in caller. */
export async function handleRoomApi(
  request: Request,
  uid: string,
  rooms: RoomNamespace,
) {
  const path = new URL(request.url).pathname;
  if (path === "/rooms" && request.method === "POST") {
    const input = createRoomInput.parse(
      JSON.parse(await readBody(request, 2_000_000)),
    );
    // Codes are short, so a live room may already hold one; draw again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      const response = await roomStub(rooms, code).fetch("https://room/init", {
        method: "POST",
        body: JSON.stringify({ code, hostUid: uid, input }),
      });
      if (response.status === 409) continue;
      await relay(response);
      return Response.json({ code }, { status: 201 });
    }
    throw new HttpError(503, "room_code_exhausted");
  }
  const ticket = /^\/rooms\/([^/]+)\/ticket$/.exec(path);
  if (ticket && request.method === "POST") {
    const code = ticket[1].toUpperCase();
    if (!ROOM_CODE.test(code)) throw new HttpError(404, "room_not_found");
    const { name } = ticketInput.parse(
      JSON.parse(await readBody(request, 2000)),
    );
    return relay(
      await roomStub(rooms, code).fetch("https://room/ticket", {
        method: "POST",
        body: JSON.stringify({ uid, name }),
      }),
    );
  }
  throw new HttpError(404, "not_found");
}

export function isRoomSocketPath(path: string) {
  return /^\/rooms\/[^/]+\/ws$/.test(path);
}

/** The socket itself is authorised by the one-time ticket, not a header. */
export async function connectRoom(request: Request, rooms: RoomNamespace) {
  const url = new URL(request.url);
  const code = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname)?.[1].toUpperCase();
  if (!code || !ROOM_CODE.test(code))
    throw new HttpError(404, "room_not_found");
  return roomStub(rooms, code).fetch(
    new Request(`https://room/ws${url.search}`, request),
  );
}
