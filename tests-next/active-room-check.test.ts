import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentJson } = vi.hoisted(() => ({ agentJson: vi.fn() }));
vi.mock("@/lib/agent-client", () => ({ agentJson }));
const { ACTIVE_ROOM_CHECK_MS, createRoom, fetchActiveRoom } =
  await import("@/lib/room-client");

describe("active room check", () => {
  beforeEach(() => {
    agentJson.mockReset().mockResolvedValue({ room: null });
  });

  it("answers repeated checks for a minute from one request", async () => {
    await fetchActiveRoom("a", 1_000);
    await fetchActiveRoom("a", 1_000 + ACTIVE_ROOM_CHECK_MS - 1);
    expect(agentJson).toHaveBeenCalledOnce();
    await fetchActiveRoom("a", 1_000 + ACTIVE_ROOM_CHECK_MS);
    expect(agentJson).toHaveBeenCalledTimes(2);
  });

  it("asks again for another account, after a failure and after creating a room", async () => {
    await fetchActiveRoom("b", 10_000_000);
    await fetchActiveRoom("c", 10_000_000);
    expect(agentJson).toHaveBeenCalledTimes(2);

    agentJson.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchActiveRoom("d", 20_000_000)).rejects.toThrow("offline");
    await fetchActiveRoom("d", 20_000_000);
    expect(agentJson).toHaveBeenCalledTimes(4);

    agentJson.mockResolvedValueOnce({ code: "ABCDEF" });
    await createRoom({ name: "n", title: "t", seconds: 20, questions: [] });
    await fetchActiveRoom("d", 20_000_000);
    expect(agentJson).toHaveBeenCalledTimes(6);
  });
});
