import { GenerationRoom, type RoomState } from "../src/generation-room";
import { upstreamBody } from "../src/generation";
import { upstreamFailure } from "../src/upstream-error";
import type { Env } from "../src/env";

export function memoryRoomState(pending: Promise<unknown>[] = []) {
  const values = new Map<string, unknown>();
  return {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    storage: {
      get: async (key: string) => structuredClone(values.get(key)),
      put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
      delete: async (key: string) => values.delete(key),
      list: async () => new Map(values),
      setAlarm: async () => {},
    },
  } as unknown as RoomState;
}
/** Only the synthetic test sender speaks HTTP; production always upgrades to WebSocket. */
export function roomFixture(env: Env, fetcher: typeof fetch, pending: Promise<unknown>[]) {
  const rooms = new Map<string, GenerationRoom>();
  return (uid: string, session: string) => {
    const key = `${uid}:${session}`;
    let room = rooms.get(key);
    if (!room) {
      room = new GenerationRoom(memoryRoomState(pending), env, async (prepared, _cursor, signal) => {
        const response = await fetcher(`${env.OPENAI_BASE_URL}/responses`, { method: "POST", body: upstreamBody(prepared), signal });
        if (!response.ok || !response.body) throw await upstreamFailure(response, { phase: "generate", transport: "websocket", model: prepared.request.model }, env.OPENAI_API_KEY);
        return response.body;
      }, fetcher);
      rooms.set(key, room);
    }
    return room;
  };
}
