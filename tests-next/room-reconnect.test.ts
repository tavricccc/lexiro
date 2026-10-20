import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestRoomTicket } = vi.hoisted(() => ({
  requestRoomTicket: vi.fn(),
}));
vi.mock("@/lib/room-client", () => ({
  requestRoomTicket,
  roomSocketUrl: () => "wss://room.test",
}));
const { MAX_RECONNECT_ATTEMPTS, useRoom } =
  await import("@/components/rooms/use-room");

describe("room reconnects", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestRoomTicket.mockReset().mockRejectedValue(new Error("network"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops asking for tickets after a bounded number of failures, then resumes on focus", async () => {
    const { result, unmount } = renderHook(() => useRoom("ABCDEF", "me", true));
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(requestRoomTicket).toHaveBeenCalledTimes(MAX_RECONNECT_ATTEMPTS + 1);
    expect(result.current.connection).toBe("reconnecting");

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requestRoomTicket).toHaveBeenCalledTimes(MAX_RECONNECT_ATTEMPTS + 2);
    unmount();
  });
});
