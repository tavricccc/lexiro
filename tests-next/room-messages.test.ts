import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/room-client", () => ({
  requestRoomTicket: async () => ({ ticket: "t" }),
  roomSocketUrl: () => "wss://room.test",
}));
const { useRoom } = await import("@/components/rooms/use-room");

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static last: FakeSocket;
  readyState = 1;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor() {
    FakeSocket.last = this;
    queueMicrotask(() => this.onopen?.());
  }
  send() {}
  close() {}
}

describe("room messages", () => {
  const original = globalThis.WebSocket;
  afterEach(() => {
    globalThis.WebSocket = original;
  });

  it("updates only the player list when someone else answers", async () => {
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    const { result, unmount } = renderHook(() => useRoom("ABCDEF", "me", true));
    await waitFor(() => expect(result.current.connection).toBe("open"));
    const state = {
      type: "state",
      serverNow: 1,
      phase: "question",
      question: { prompt: "bank?" },
      players: [{ uid: "a", answered: false }],
    };
    act(() => FakeSocket.last.onmessage!({ data: JSON.stringify(state) }));
    act(() =>
      FakeSocket.last.onmessage!({
        data: JSON.stringify({
          type: "players",
          serverNow: 2,
          players: [{ uid: "a", answered: true }],
        }),
      }),
    );
    expect(result.current.state).toMatchObject({
      phase: "question",
      question: { prompt: "bank?" },
      players: [{ uid: "a", answered: true }],
    });
    unmount();
  });
});
