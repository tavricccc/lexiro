import { describe, expect, it } from "vitest";
import {
  GameRoom,
  type GameRoomState,
  type RoomSocket,
} from "../src/rooms/game-room";
import {
  MAX_PLAYERS,
  REVEAL_MS,
  createRoomInput,
  scoreFor,
} from "../src/rooms/protocol";

class FakeSocket implements RoomSocket {
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  private attachment: unknown;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  serializeAttachment(value: unknown) {
    this.attachment = value;
  }
  deserializeAttachment() {
    return this.attachment;
  }
  last() {
    return this.sent.at(-1) as Record<string, any>;
  }
}

function fixture() {
  let clock = 1_000_000;
  const storage = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  let alarm = 0;
  const ctx: GameRoomState = {
    storage: {
      get: async <T>(key: string) => structuredClone(storage.get(key)) as T,
      put: async (key, value) => void storage.set(key, structuredClone(value)),
      delete: async (key) => storage.delete(key),
      deleteAll: async () => storage.clear(),
      setAlarm: async (at) => void (alarm = at),
    },
    acceptWebSocket: (socket) => void sockets.push(socket as FakeSocket),
    getWebSockets: () => sockets,
  };
  const room = new GameRoom(ctx, undefined, () => clock);
  const join = async (uid: string, name = uid) => {
    const ticket = await room.issueTicket(uid, name);
    const socket = new FakeSocket();
    await room.attach(socket, await room.admit(ticket));
    return socket;
  };
  return {
    room,
    join,
    advance: async (ms: number) => {
      clock += ms;
      if (alarm && alarm <= clock) await room.alarm();
    },
    get alarm() {
      return alarm;
    },
  };
}

const input = createRoomInput.parse({
  name: "Host",
  title: "Finance",
  questions: [
    {
      display: { type: "vocabulary", prompt: "bank?", options: ["A", "B", "C", "D"] },
      answerIndex: 2,
      explanation: "C is right",
    },
    {
      display: { type: "meaning", prompt: "river?", options: ["A", "B", "C", "D"] },
      answerIndex: 0,
    },
  ],
});

describe("live game room", () => {
  it("keeps the answer on the server until the question is over", async () => {
    const f = fixture();
    await f.room.init("ABCDEF", "host", input);
    const host = await f.join("host", "Host");
    const guest = await f.join("guest", "Guest");
    await f.room.webSocketMessage(guest, JSON.stringify({ type: "start" }));
    expect(guest.last().phase).toBe("lobby");
    await f.room.webSocketMessage(host, JSON.stringify({ type: "start" }));
    const asked = guest.last();
    expect(asked).toMatchObject({ phase: "question", index: 0, total: 2, reveal: null });
    expect(JSON.stringify(asked)).not.toContain("answerIndex");
    expect(JSON.stringify(asked)).not.toContain("C is right");

    await f.advance(5_000);
    await f.room.webSocketMessage(guest, JSON.stringify({ type: "answer", index: 0, choice: 2 }));
    // The host can see that the guest answered, not what or whether it was right.
    expect(host.last().players).toEqual(
      expect.arrayContaining([expect.objectContaining({ uid: "guest", answered: true, score: 0 })]),
    );
    expect(host.last().reveal).toBeNull();

    await f.room.webSocketMessage(host, JSON.stringify({ type: "answer", index: 0, choice: 1 }));
    const revealed = guest.last();
    expect(revealed.phase).toBe("reveal");
    expect(revealed.reveal).toMatchObject({ answerIndex: 2, explanation: "C is right" });
    expect(revealed.players[0]).toMatchObject({
      uid: "guest",
      score: scoreFor(true, 15_000, 20_000),
    });
    expect(revealed.players[1]).toMatchObject({ uid: "host", score: 0 });
  });

  it("moves on without anyone who left and lets them rejoin at the current question", async () => {
    const f = fixture();
    await f.room.init("ABCDEF", "host", input);
    const host = await f.join("host");
    const guest = await f.join("guest");
    await f.room.webSocketMessage(host, JSON.stringify({ type: "start" }));
    guest.close();
    await f.room.webSocketClose(guest);
    expect(host.last().players.find((p: { uid: string }) => p.uid === "guest").connected).toBe(false);

    // Only the player still here is waited for.
    await f.room.webSocketMessage(host, JSON.stringify({ type: "answer", index: 0, choice: 2 }));
    expect(host.last().phase).toBe("reveal");
    await f.advance(REVEAL_MS);
    expect(host.last()).toMatchObject({ phase: "question", index: 1 });

    const back = await f.join("guest");
    expect(back.last()).toMatchObject({ phase: "question", index: 1, yourChoice: null });
    expect(back.last().players.find((p: { uid: string }) => p.uid === "guest").score).toBe(0);

    // Nobody answers: the clock alone ends the question, then the game.
    await f.advance(15_000);
    expect(host.last().phase).toBe("reveal");
    await f.advance(REVEAL_MS);
    expect(host.last().phase).toBe("ended");
  });

  it("seats at most eight players but always lets a player back in", async () => {
    const f = fixture();
    await f.room.init("ABCDEF", "host", input);
    for (let i = 1; i < MAX_PLAYERS; i++) await f.join(`p${i}`);
    await expect(f.room.issueTicket("late", "Late")).rejects.toMatchObject({ code: "room_full" });
    await expect(f.room.issueTicket("p3", "Again")).resolves.toEqual(expect.any(String));
  });

  it("spends a ticket once and only accepts answers to the open question", async () => {
    const f = fixture();
    await f.room.init("ABCDEF", "host", input);
    const ticket = await f.room.issueTicket("guest", "Guest");
    await f.room.admit(ticket);
    await expect(f.room.admit(ticket)).rejects.toMatchObject({ code: "ticket_invalid" });

    const host = await f.join("host");
    await f.room.webSocketMessage(host, JSON.stringify({ type: "start" }));
    await f.room.webSocketMessage(host, JSON.stringify({ type: "answer", index: 1, choice: 0 }));
    await f.room.webSocketMessage(host, JSON.stringify({ type: "answer", index: 0, choice: 9 }));
    expect(host.last()).toMatchObject({ phase: "question", yourChoice: null });
    await f.room.webSocketMessage(host, "not json");
    expect(host.last()).toEqual({ type: "error", code: "invalid_message" });
  });

  it("rejects a question bank whose answer is not one of its options", () => {
    expect(() =>
      createRoomInput.parse({
        ...input,
        questions: [{ ...input.questions[0], answerIndex: 4 }],
      }),
    ).toThrow();
  });
});
